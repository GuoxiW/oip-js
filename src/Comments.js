var CommentsFunction = function(){
	var Network = this.Network;

	var Comments = {};

	Comments.get = function(hash, callback){
		Network.getCommentsFromISSO("/" + hash.substring(0,6), function(results){
			console.log(results);
			callback(results);
		})
	}

	Comments.add = function(hash, comment, callback){
		Network.postCommentToISSO("/" + hash.substring(0,6), comment, function(results){
			console.log(results)
			callback(results);
		})
	}

	Comments.like = function(id, callback){
		Network.likeISSOComment(id, function(results){
			console.log(results)
			callback(results);
		})
	}

	Comments.dislike = function(id, callback){
		Network.dislikeISSOComment(id, function(results){
			console.log(results)
			callback(results);
		})
	}

	this.Comments = Comments;
	return this.Comments;
}

export default CommentsFunction;