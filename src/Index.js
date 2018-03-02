const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')
var _ = require('lodash')

var IndexFunction = function(){
	var Artifact = this.Artifact;
	var Network = this.Network;
	var LocStorage = this.localStorage;
	var settings = this.settings;

	var Index = {};

	Index.db = low(new Memory())

	Index.db.defaults({ 
		AllArtifacts: [],
		SupportedArtifacts: [],
		Publishers: [],
		Retailers: [],
		Promoters: [],
		Autominers: [],
		AutominerPools: [],
		shortHashToLong: []
	}).write()

	Index.addToDb = function(dbObject, insertObject){
		var addToList = function(dbObj, insObj){
			var exists = Index.db.get(dbObj).find({ txid: insObj.txid }).value();

			if (!exists){
				return Index.db.get(dbObj).push(insObj).write();
			}
		}

		if (Array.isArray(insertObject)){
			for (var ins of insertObject){
				addToList(dbObject, ins);
			}
		} else {
			return addToList(dbObject, insertObject);
		}
	}

	Index.getSupportedArtifacts = function(onSuccess, onError){
		var SupportedArtifactList = Index.db.get("SupportedArtifacts").orderBy("timestamp", "desc").value();

		if (SupportedArtifactList.length < 50){
			Network.getArtifactsFromOIPd(function(jsonResult) {
				let supported = Index.stripUnsupported(jsonResult);
				let filtered = Index.filterArtifacts(supported);

				onSuccess([...filtered]);
			}, onError);
		} else {
			onSuccess(SupportedArtifactList)
		}
	}

	Index.getSuggestedContent = function(userid, callback){
		// In the future we will generate content specific for users, for now, just the generic is ok :)
		// userid is not currently implemented or used.
		Index.getSupportedArtifacts(function(supportedArtifacts){
			if (supportedArtifacts.length > 25){
				callback(supportedArtifacts.slice(0,25));
			} else {
				callback(supportedArtifacts);
			}
		})
	}

	Index.stripUnsupported = function(artifacts){
		var supportedArtifacts = [];

		for (var x = artifacts.length -1; x >= 0; x--){
			if (artifacts[x]['oip-041']){
				if (artifacts[x]['oip-041'].artifact.type.split('-').length === 2){
					if (artifacts[x]['oip-041'].artifact.type !== "Property")
						supportedArtifacts.push(artifacts[x]);
				}
			}
		}   

		return [...supportedArtifacts];
	}

	Index.filterArtifacts = function(artifacts){
		var filteredArtifacts = artifacts;

		if (Array.isArray(settings.artifactFilters)){
			for (var filter of settings.artifactFilters){
				filteredArtifacts = _.filter(filteredArtifacts, filter)
			}
		} else {
			filteredArtifacts = _.filter(filteredArtifacts, settings.artifactFilters)
		}

		for (var i in filteredArtifacts){
			filteredArtifacts[i].short = filteredArtifacts[i].txid.substr(0,6)
		}

		Index.addToDb("SupportedArtifacts", filteredArtifacts)

		return [...filteredArtifacts];
	}

	Index.getArtifactFromID = function(id, onSuccess, onError){
		var short = false;

		if (id.length < 11){
			short = true;
		}

		var filter = {};

		filter[short ? "short" : "txid"] = id;

		var artifactInDb = Index.db.get("SupportedArtifacts").find(filter).value();

		if (!artifactInDb) {
			Index.search({"protocol": "media", "search-on": "txid", "search-for": id}, function(results){
				if (results.length === 0){
					onError("Artifact Not Found")
				} else {
					onSuccess(results[0]);
				}
			}, function(err){
				onError(err);
			});
		} else {
			onSuccess(artifactInDb);
		}
	}

	Index.search = function(options, onSuccess, onError){
		Network.searchOIPd(options, function(results){
			if (options.protocol === "media") {
				let supported = Index.stripUnsupported(results);
				let filtered = Index.filterArtifacts(supported);

				onSuccess(filtered);
			} else {
				onSuccess(results);
			}
		}, function(error){
			onError(error);
		})
	}

	Index.getRegisteredPublishers = function(onSuccess, onError){
		var pubs = [];
		if (LocStorage.registeredPublishers){
			pubs = JSON.parse(LocStorage.registeredPublishers).arr;
		}

		Network.getPublishersFromOIPd(function(results) {
			var newPubs = results;
			for (var i = 0; i < pubs.length; i++) {
				newPubs.push(pubs[i])
			}

			Index.addToDb("Publishers", results)
			onSuccess(newPubs);
		});
	}

	Index.getRegisteredRetailers = function(onSuccess, onError){
		Network.getRetailersFromOIPd(function(results) {
			Index.addToDb("Retailers", results)
			onSuccess(results);
		});
	}

	Index.getRegisteredPromoters = function(onSuccess, onError){
		Network.getPromotersFromOIPd(function(results) {
			Index.addToDb("Promoters", results)
			onSuccess(results);
		});
	}

	Index.getPublisher = function(id, onSuccess, onError){
		if (LocStorage.registeredPublishers){
			var pubs = JSON.parse(LocStorage.registeredPublishers).arr;

			var found = false;

			for (var pub of pubs){
				if (pub.address.substr(0, id.length) === id){
					found = true;
					onSuccess(pub);
					return;
				}
			}
		}

		var publisherInDb = Index.db.get("Publishers").find({address: id}).value();

		if (publisherInDb) {
			onSuccess(publisherInDb)
		} else {
			Network.searchOIPd({"protocol": "publisher", "search-on": "address", "search-for": id}, function(results){
				var pub = results[0]['publisher-data']['alexandria-publisher'];

				Index.addToDb("Publishers", pub)

				onSuccess(pub);
			}, function(err){
				onError(err);
			});
		}
	}

	Index.getRetailer = function(id, onSuccess, onError){
		var retailerInDb = Index.db.get("Retailers").find({address: id}).value();

		if (retailerInDb) {
			onSuccess(retailerInDb)
		} else {
			Network.searchOIPd({"protocol": "retailer", "search-on": "address", "search-for": id}, function(results){
				var retailer = results[0];

				Index.addToDb("Retailers", retailer)

				onSuccess(retailer);
			}, function(err){
				onError(err);
			});
		}
	}

	Index.getPromoter = function(id, onSuccess, onError){
		var retailerInDb = Index.db.get("Promoters").find({address: id}).value();

		if (retailerInDb) {
			onSuccess(retailerInDb)
		} else {
			Index.search({"protocol": "retailer", "search-on": "address", "search-for": id}, function(results){
				var retailer = results[0];

				Index.addToDb("Retailers", retailer)

				onSuccess(retailer);
			}, function(err){
				onError(err);
			});
		}
	}

	Index.getPublisherArtifacts = function(pubAddress, onSuccess, onError){
		Index.search({"protocol": "media", "search-on": "address", "search-for": id}, function(results){
			onSuccess(results);
		}, function(err){
			onError(err);
		});
	}

	Index.getRandomSuggested = function(onSuccess){
		Index.getSupportedArtifacts(function(results){
			let randomArt = [...results].sort( function() { return 0.5 - Math.random() } ).slice(0,15);
			onSuccess(randomArt);
		});
	}

	Index.stripIndexData = function(artJson){
		var strippedArtJSON = {
			"oip-041": artJson["oip-041"]
		}

		return strippedArtJSON;
	}

	this.Index = Index;
	return this.Index;
}

export default IndexFunction;