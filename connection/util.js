// Form parent ids
function formParents_GL({baseInfo, mergeInfo}){

	//TODO: what if pr has two CAs
	let caHead = mergeInfo.commits[0].parent_ids[0];
	let parents = {
		baseHead: baseInfo.commit.id,
		prHead: mergeInfo.commit.id
	}

	if (parents.baseHead !== caHead)
		parents["caHead"] = caHead

	return ({ parents })
}


// Form parent ids
function formParents_GH({ mergeInfo }){

	//TODO: what if pr has two CAs
	let caHead = mergeInfo.merge_base_commit.sha;
	let parents = {
		baseHead: mergeInfo.base_commit.sha,
		prHead: mergeInfo.commits.pop().sha
	};

	if (parents.baseHead !== caHead)
		parents["caHead"] = caHead

	return ({ parents })
}


// Form urls for all trees need to be fetched
function formTreeUrls_GL(baseBranch, prBranch, dirs){
	/**
	 * To create the merge commit, we need only trees of base and pr
	 * No need to get the tree of common ancestor
	 * In case of GitLab, we get trees for changed dirs
	 **/

	let trees = {
		base: treeUrls_GL(baseBranch, dirs),
		pr: treeUrls_GL(prBranch, dirs),
	}

	return {
		urls: [...trees.base, ...trees.pr]
	}
}


// Form urls for all trees need to be fetched 
function formTreeUrls_GH(prInfo, mergeInfo){
	/**
	 * To create the merge commit, we need only trees of base and pr,
	 * no need to get the tree of common ancestor.
	 * In case of GitHub, we get all trees based on two hashes.
	 * Commits on mergeInfo are not always included on Github response,
	 * so we get tree info from pr branch
	 **/

	let trees = {
		base: mergeInfo.base_commit.commit.tree.sha,
		pr: prInfo.commit.tree.sha,
		//pr: mergeInfo.commits.pop().commit.tree.sha 
	}

	return {
		treeIds: trees,
		urls: treeUrls_GH([trees.base, trees.pr])
	}
}


function treeUrls_GL(branch, dirs){
	let urls = [];
	let endpoint = `${REPO_API}/tree?ref=${branch}&path=`;
	for (dir of dirs){
		urls.push(`${endpoint}${trimPath(dir)}`);
	}

	return urls;
}


function treeUrls_GH(trees){
    // TODO: Handle truncated trees

	let urls = [];
	let endpoint = `${REPO_API}/git/trees/`;
	for (tree of trees){
		urls.push(`${endpoint}${tree}?recursive=1`);
	}

	return urls;
}


// Form urls for all files need to be fetched 
function formBlobUrls(parents, blobs){

	// If baseHead and caHead are not the same, fetch files for caHead
	let caRefs = []
	if  (parents.hasOwnProperty("caHead"))
		caRefs = fileUrls (parents.caHead, blobs)
	let baseRefs = fileUrls (parents.baseHead, blobs)
	let prRefs = fileUrls (parents.prHead, blobs)

	return [...baseRefs, ...prRefs, ...caRefs]
}


// Form file Endpoints for a remote ref
function fileUrls(ref, files){

	let urls = [];
	if (SERVER == SERVER_GL){
		let endpoint = `${REPO_API}/files/`;
		for (file of files){
			urls.push(`${endpoint}${trimPath(file)}/raw?ref=${ref}`);
		}
	}
	if (SERVER == SERVER_GH){
		let endpoint = `${REPO_API}/contents/`;
		for (file of files){
			urls.push(`${endpoint}${file}?ref=${ref}`);
		}
	}
	return urls;
}

// Extract the fpath and ref name of fetched blobs
function blobParser({ item, info, data }){

	let result;
	if (SERVER == SERVER_GL)
		result = blob_GL({ item, info, data });
	if (SERVER == SERVER_GH)
		result = blob_GH({ item, info, data });

	let {key, ref, content} = result;
	// Initialize sub-object
	if(key in data == false){
		data[key] = {}; 
	}
	data [key][ref] = content; //TODO: Make a return
}


// Extract the fpath and ref name of fetched blobs
function blob_GL({ item, info }){

	let key = untrimPath(extractBetween(item, "/files/", "/raw?"));
	let ref = extractAfter(item, "?ref=");

	return {key, ref, content: info}
}


// Extract the fpath and ref name of fetched blobs
function blob_GH({ item, info}){

	let key = info.path;
	let ref = extractAfter(info.url, "?ref=");

	return {key, ref, content: atob(info.content)}
}


// Extract the fpath and ref name of fetched trees
function treeParser_GL({ item, info, data }){

	let key = extractBetween(item, "?ref=", "&path=");
	let ref = untrimPath(extractAfter(item, "&path="));

	// Initialize sub-object, otherwise you'll get errors
	if(key in data == false){
		data[key] = {}; 
	}

	data [key][ref] = formTreeEntries_GL(info);
}


// Extract the fpath and ref name of fetched trees
function treeParser_GH({ info, data }){
	data [info.sha] = info.tree;
}


//Form Trees
function formTreeEntries_GL(entries){

	let trees = {};
	for (let entry of entries) {
		// Omit the first char of the tree mode
		let mode = entry.mode;
		entry.mode = mode == "040000"? "40000": mode;
		trees[entry.name] = entry;
	}

	return trees;
}


//Form Trees
function formTreeEntries_GH(entries){

	let trees = {}
	for (let entry of entries) {
		let path = entry.path;
		let parent = getParentPath(path);
		let name = removeParentPath (path);

		if(parent in trees == false){
			trees[parent] = {}; 
		}

		// Add entry name, rename sha with id
		entry["name"] = name;
		entry["id"] = entry.sha; delete entry["sha"];

		// Omit the first char of the tree mode
		let mode = entry.mode;
		entry.mode = mode == "040000"? "40000": mode;
		trees[parent][name] = entry;
	}

	return trees;
}


