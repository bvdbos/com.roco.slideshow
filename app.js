'use strict';

const Homey = require('homey');
const dateformat = require('dateformat');
var FeedMe = require('feedme');
var http = require('http');
var https = require('https');
var urllist = []; //array with {name,url,latestbroadcast,latesturl} feeds from settings
var data = []; //name with image-urls
var playlist = []; //array of playlists
var total = 0
var tokenval 
var refreshIntervalId
var statusplay
let triggercard
let newpicpostedcard
let startPlayAction
let randomPlayAction
var pollingtime = 900000

class Slideshow extends Homey.App {	
	onInit() {
		Homey.app.log('Slideshow starting');
		
		triggercard = {
			'newpicpostedcard': new Homey.FlowCardTrigger('new_slideshow_pic_spotted'),
			'newslideshowpic': new Homey.FlowCardTrigger('new_slideshow_pic')
		};
		
		triggercard.newpicpostedcard.register();
		triggercard.newslideshowpic.register();

		//tokenval = new Homey.FlowToken( 'slide', {
		//				type: 'string',
		//				title: 'slide'
		//			});
		//tokenval.register()
		//			.then(() => {
		//				return tokenval.setValue( null );
		//			})			
			
		let stopPlayAction = new Homey.FlowCardAction('stop_play');
			stopPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					clearInterval(refreshIntervalId)
					statusplay = false
					let isStopped = true; // true or false
					return Promise.resolve( isStopped );
				});

		startPlayAction = new Homey.FlowCardAction('start_play');
			startPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					var pauze = args.pauze;
					var chosen = args.list_sources.description || "all slideshows"
					if (statusplay = true) {
						clearInterval(refreshIntervalId)
					}
					play(pauze, chosen);
					statusplay = true
					let isStarted = true; // true or false
					return Promise.resolve( isStarted );
				})
				
			
				
		randomPlayAction = new Homey.FlowCardAction('random_play');
			randomPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					var pauze = args.pauze;
					var chosen = args.list_sources.description || "all slideshows"
					if (statusplay = true) {
						clearInterval(refreshIntervalId)
					}
					randomplay(pauze, chosen);
					statusplay = true
					let isStarted = true; // true or false
					return Promise.resolve( isStarted );
				});
				
		Homey.ManagerSettings.on('set', function(settings) {
			getsettings().then(function(settings) {
				urllist=settings;
				//Homey.app.log(urllist)
				startPlayAction.getArgument('list_sources').registerAutocompleteListener(query => {
					var templist = []
					templist.push ({name: 'all', description: 'all slideshows'})
					urllist.forEach(function(listobject) {
						templist.push ({name: listobject.name, description: listobject.url})
					})
					return Promise.resolve(templist)
				})
				randomPlayAction.getArgument('list_sources').registerAutocompleteListener(query => {
					var templist = []
					templist.push ({name: 'all', description: 'all slideshows'})
					urllist.forEach(function(listobject) {
						templist.push ({name: listobject.name, description: listobject.url})
					})
					return Promise.resolve(templist)
				})
				readfeeds().then(function(results) {
					Homey.app.log("feeds read from changing settings");
					playlist=results;
					Homey.app.log("data is ", data.length)
				})		
			});
		});

		getsettings().then(function(settings) {
			Homey.app.log("initial settings read");
			urllist=settings;
			
			startPlayAction.getArgument('list_sources').registerAutocompleteListener(query => {
				var templist = []
				templist.push ({name: 'all', description: 'all slideshows'})
				urllist.forEach(function(listobject) {
					templist.push ({name: listobject.name, description: listobject.url})
				})
				return Promise.resolve(templist)
			})
			
			randomPlayAction.getArgument('list_sources').registerAutocompleteListener(query => {
				var templist = []
				templist.push ({name: 'all', description: 'all slideshows'})
				urllist.forEach(function(listobject) {
					templist.push ({name: listobject.name, description: listobject.url})
				})
				return Promise.resolve(templist)
			})
			
			readfeeds().then(function(results) {
				playlist=results;
				Homey.app.log("initial playlist and data read")
				Homey.app.log("data is ", data.length)
			})
			
		})
		
		startPollingForUpdates();

	}
}

function startPollingForUpdates() {
	var pollingInterval = setInterval(() => {
		console.log("poll feeds")
		readfeeds().then(function(results) {
			//playlist=results;
			//Homey.app.log("playlist and data read")
			Homey.app.log("feeds polled, data is ", data.length)
		})	
	}, pollingtime);
};

//get name and url list from settings and create array
function getsettings() {
	return new Promise(function(resolve,reject){
		var replText = Homey.ManagerSettings.get('slideshow');
		
		//first create a list of the name-url's
		var newlist = [];
		if (replText != null && typeof replText === 'object') {
			Object.keys(replText).forEach(function (key) {
				var url = replText[key];
				newlist.push( {"name":key,"url":url})
				return newlist;
			});
		
			//then for each item read from settings, check if it already exists and take data
			if (newlist.length > 0) { //shouldn't be necessarry as replText returned an object
				newlist.forEach(function(listobject) {
					var objIndex = urllist.findIndex(obj => obj.url == listobject.url);
					//if it exists then take it's settings
					if (objIndex > -1) {
						listobject.latestbroadcast = urllist[objIndex].latestbroadcast;
						listobject.latesturl = urllist[objIndex].latesturl;
					//if it doesn't exist then create items
					} else {
						listobject.latestbroadcast = null;
						listobject.latesturl = "";
					}
				});
			}
			
			//check if items were deleted
			if (urllist.length > 0) {
				urllist.forEach(function(listobject) {
					//Homey.app.log(listobject)
					var objIndex = newlist.findIndex(obj => obj.url == listobject.url);
					if (objIndex < 0) {
						Homey.app.log("an item from oldlist is not in the new list")
					} else {
						Homey.app.log("an item from oldlist is also in the new list")
					}
				});
			}

			//so now we have a newlist array
			resolve(newlist)
		}
	})
}	

function filterdata(chosen) {
	if (chosen != "all slideshows") {
		var playl = [];
		for (var k = 0; k < data.length; k++) {
			if (data[k].source == chosen) {
				playl.push(data[k]);
			}
		}
	} else {
		var playl = data
	}
	return playl
}

function play (pauze, chosen) {
	console.log("sequential play ", chosen)
	var playl = filterdata(chosen)
	var total = playl.length;
	console.log(total, " items")
	var counter = 0;	
	refreshIntervalId = setInterval(() => {
		if (counter > total-1) { counter = 0; }
		Homey.app.log (counter)
		//tokenval.setValue(playl[counter].item);
		triggercard.newslideshowpic.trigger(playl[counter]);
		counter = counter+1;
	}, pauze * 1000);
}

function randomplay (pauze, chosen) {
	console.log("random play ", chosen)
	var playl = filterdata(chosen)
	var total = playl.length;
	console.log(total, " items")
	var counter = 0;	
	refreshIntervalId = setInterval(() => {
		counter=getRandomInt(0,total-1)
		Homey.app.log (counter)
		console.log(playl[counter])
		//tokenval.setValue(playl[counter].item);
		triggercard.newslideshowpic.trigger(playl[counter]);
	}, pauze * 1000);
}

async function readfeeds() {
		var temparray = [];
		data = []
		for(var i = 0; i < urllist.length; i++) {
				var obj = urllist[i];
				var item = await readfeed(obj.url);
				temparray.push (item);
		};
		return temparray;
};
	
function readfeed(feedurl) { //returns an array of playlists
	return new Promise(resolve => {
		
		//for https-urls
		if (feedurl.substring(0,5) == "https") {		
			https.get(feedurl, function(res) {
				console.log("get https-feed ", feedurl)
				var parser = new FeedMe(true);
				var teller=0;					
				res.pipe(parser);			
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == feedurl)); //get correct item from urllist
						if (urllist[objIndex].latestbroadcast != null) { //already a latest url in tag
							var oldtimestamp = urllist[objIndex].latestbroadcast;
							var newtimestamp = Date.parse(item.pubdate)/1000;
							if (newtimestamp > oldtimestamp) { //new item						
								urllist[objIndex].latestbroadcast = newtimestamp
								var c3 = getimages(item.description)
								//var firstpic = c3[0].substring(5,c3[0].length-1)
								var firstpic = c3[0]
								urllist[objIndex].latesturl = firstpic;
								let tokens = {
									'item': firstpic || "",
									'pictitle': item.title,
									'pcname': urllist[objIndex].name,
									'tijd': item.pubdate									
								}
								triggercard.newpicpostedcard.trigger(tokens)	
								
							} else {
								//no new item
							}
						} else { //no latestbroadcast so set first url in tag
							urllist[objIndex].latesturl = item.guid
							urllist[objIndex].latestbroadcast = Date.parse(item.pubdate)/1000;
						}
						teller=teller+1; //only first item
					};	
				});
										

				parser.on('end', function() {
					var pl = parser.done();
					var result = {
						type: 'photolist',
						url: feedurl,
						id: pl.title,
						title: pl.title,
						tracks: parseTracks(pl.items, feedurl) || false,
					};
					
				parser.on('error', err => { Homey.app.log(err) })
				
				resolve(result);
				});	
			});	
		} else { //http-url
			http.get(feedurl, function(res) {
				console.log("get http-feed ", feedurl)
				var parser = new FeedMe(true);
				var teller=0;					
				res.pipe(parser);
				
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == feedurl)); //get correct item from urllist
						if (urllist[objIndex].latestbroadcast != null) { //already a latest url in tag
							var oldtimestamp = urllist[objIndex].latestbroadcast;
							var newtimestamp = Date.parse(item.pubdate)/1000;
							if (newtimestamp > oldtimestamp) { //new item
								urllist[objIndex].latestbroadcast = newtimestamp
								var c3 = getimages(item.description)
								var firstpic = c3[0].substring(5,c3[0].length-1)
								urllist[objIndex].latesturl = firstpic;
								let tokens = {
									'item': firstpic || "",
									'pictitle': item.title,
									'pcname': urllist[objIndex].name,
									'tijd': item.pubdate									
								}
								triggercard.newpicpostedcard.trigger(tokens)	
								
							} else {
								//no new item
							}
						} else { //no latestbroadcast so set first url in tag
							urllist[objIndex].latesturl = ""
							urllist[objIndex].latestbroadcast = Date.parse(item.pubdate)/1000;
						}
						teller=teller+1; //only first item
					};	
				});
						
					

				parser.on('end', function() {
					var pl = parser.done();
					var result = {
						type: 'photolist',
						url: feedurl,
						id: pl.title,
						title: pl.title,
						tracks: parseTracks(pl.items, feedurl) || false,
					};
					
				parser.on('error', err => { Homey.app.log(err) })
				
				resolve(result);
				});
			});	
		}					
	});
};


	
	
function parseTracks(tracks, feedurl) {
	const result = [];
	if (!tracks) {
		return result;
	}
	tracks.forEach((track) => {
		const parsedTrack = parseTrack(track,feedurl);
		if (parsedTrack !== null) {
			parsedTrack.confidence = 0.5;
			result.push(parsedTrack);
		}
	});
	return result;
}

function parseTrack(track,feedurl) {
	//create data-items
	var item = track.description
    var pubdate = track.pubdate || ""
	var c2 = getimages(item);
	if (c2 != null) {
		for (var j = 0, len2 = c2.length; j < len2; j++) {
			//var turl = c2[j].substring(5,c2[j].length-1)
			var tobj = {'source': feedurl, 'item': c2[j], 'tijd': pubdate, 'pctitle': track.title};
			//console.log(tobj)
			data.push(tobj)
		}
	}
	return {
		type: 'track',
		id: track.guid,
		title: track.title,
		description: track.description,
		release_date: dateformat(track.pubdate || ""),
	}
}

function getimages(item) {
	//console.log(item) 
	//item.replace(/</g,'&lt;').replace(/>/g,'&gt;')
	//var patt = /src="([^"]+)"/g
	//var patt = /([a-z\-_0-9\/\:\.]*\.(jpg|jpeg|png|gif))/g
	var patt = /http[^" ]*?\.(jpg|png|png|gif)/g
	var c2 = item.match(patt);
	console.log(c2)
	return c2
	
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function hmsToSecondsOnly(str) {
	if (str != null) {
		//Homey.app.log(str);
    var p = str.split(':'),
        s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
	s=s*1000
	//Homey.app.log(s);
	} else {s=null}
    return s;
}

module.exports = Slideshow;