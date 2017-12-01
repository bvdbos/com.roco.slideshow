'use strict';

const Homey = require('homey');
const dateformat = require('dateformat');
var FeedMe = require('feedme');
var http = require('http');
var https = require('https');
var urllist = []; //array with {name,url,latestbroadcast,latesturl,token} feeds from settings
var data = []; //name with image-urls
var total = 0
var tokenval 
var refreshIntervalId
var statusplay
let triggercard

class Slideshow extends Homey.App {	
	onInit() {
		this.log('Slideshow starting');
		
		triggercard = new Homey.FlowCardTrigger('new_slideshow_pic');
		triggercard.register();
			
		tokenval = new Homey.FlowToken( 'slide', {
						type: 'string',
						title: 'slide'
					});
				tokenval.register()
					.then(() => {
						return tokenval.setValue( null );
					})			
			
		let stopPlayAction = new Homey.FlowCardAction('stop_play');
			stopPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					clearInterval(refreshIntervalId)
					statusplay = false
					let isStopped = true; // true or false
					return Promise.resolve( isStopped );
				});

		let startPlayAction = new Homey.FlowCardAction('start_play');
			startPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					var pauze = args.pauze;
					if (statusplay = true) {
						clearInterval(refreshIntervalId)
					}
					play(pauze);
					statusplay = true
					let isStarted = true; // true or false
					return Promise.resolve( isStarted );
				});

		Homey.ManagerSettings.on('set', function(settings) {
			getsettings().then(function(urlsettings) {
				urllist=urlsettings;
				readfeeds().then(function(results) {
					console.log("feeds read from changing settings");
					urllist=results;
				})		
			});
		});

		getsettings().then(function(results) {
			console.log("settings read");
			urllist=results;
			console.log(urllist);
			readfeeds().then(function(results) {
				urllist=results;
				console.log("data is ", data.length)
			})
		})
	}
}

//get name and url list from settings and create array
function getsettings() {
	return new Promise(function(resolve,reject){
		var replText = Homey.ManagerSettings.get('slideshow');
		//first create a list of the name-url's
		var list = [];
		if (replText != null && typeof replText === 'object') {
			Object.keys(replText).forEach(function (key) {
				var url = replText[key];
				list.push( {"name":key,"url":url})
				return list;
			});
		
		//then for each name-url read from settings, check if it already exists
		list.forEach(function(listobject) {
			console.log("urllist")
			console.log(urllist)
			var objIndex = urllist.findIndex(obj => obj.url == listobject.url);
			console.log ("objIndex ", objIndex, "in urllist voor ",listobject.url);
			//if it exists the take it's settings
			if (objIndex > -1) {
				console.log("gegevens overnemen");
				listobject.latestbroadcast = urllist[objIndex].latestbroadcast;
				listobject.latesturl = urllist[objIndex].latesturl;

			} else {
				listobject.latestbroadcast = null;
				listobject.latesturl = "";
				console.log ("add ", listobject.url)
				//listobject.flowTriggers = {newpodcast: new Homey.FlowCardTrigger('new_podcast_item')};
				//listobject.flowTriggers.newpodcast.register();
			}
		});
		
		if (urllist.length > 0) {
		urllist.forEach(function(listobject) {
			var objIndex = urllist.findIndex(obj => obj.url == listobject.url);
			console.log("listobject in lijst ", objIndex);
			if (objIndex < 0) {
				console.log("delete ", obj.url)
				//not found so delete
			} else {
				//found so do nothing
			}
		});
		}
		console.log(list)
		resolve(list);	
		}
	})
}	


function play (pauze) {
	var total = data.length;
	var counter = 0;	
	//console.log(tokenval)
	console.log(data[counter])
	console.log(triggercard)
	refreshIntervalId = setInterval(() => {
		if (counter > total-1) { counter = 0; }
		console.log (counter)
		console.log (data[counter])
		tokenval.setValue(data[counter].item);
		triggercard.trigger(data[counter]);
		counter = counter+1;
	}, pauze * 1000);
}

async function readfeeds() {
		var temparray = [];
		for(var i = 0; i < urllist.length; i++) {
				var obj = urllist[i];
				console.log("readfeed ", obj.url);
				var item = await readfeed(obj.url);
				temparray.push (item);
		};
		return temparray;
};
	
function readfeed(url) {
	return new Promise(resolve => {
			https.get(url, function(res) {
				var parser = new FeedMe(true);
				var teller=0;
				
				/*
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == url));
						console.log(objIndex);
						if (urllist[objIndex].latestbroadcast != null) { //already a latest url in tag
							var oldtimestamp = urllist[objIndex].latestbroadcast;
							var oldurl=urllist[objIndex].latesturl;
							var newtimestamp = Date.parse(item.pubdate)/1000;
							if (newtimestamp > oldtimestamp) { //new item
								urllist[objIndex].latestbroadcast = newtimestamp
								urllist[objIndex].token.setValue(item.enclosure.url);
								urllist[objIndex].latesturl = item.enclosure.url;
								
								//here a trigger should be fired
								let tokens = {
									'item': item.enclosure.url,
									'tijd': item.pubdate,
									'vctitle': urllist[objIndex].name,
								}
								console.log(tokens);
								//console.log(urllist[objIndex].flowTriggers.newvodcast);
								urllist[objIndex].flowTriggers.newvodcast.trigger(tokens).catch( this.error );
								
								
							} else {
								//no new item
							}
						} else { //set first url in tag
							urllist[objIndex].token.setValue(item.enclosure.url);						
							urllist[objIndex].latesturl = item.enclosure.url;
							urllist[objIndex].latestbroadcast = Date.parse(item.pubdate)/1000;
						}
						teller=teller+1; //only first item
					};	
				});
				*/				
				res.pipe(parser);			

				parser.on('end', function() {
					var pl = parser.done();
					var result = {
						type: 'photolist',
						id: pl.title,
						title: pl.title,
						tracks: parseTracks(pl.items) || false,
					};
				resolve(result);
				});	
			});		
	});
};


	
	
function parseTracks(tracks) {
	const result = [];
	if (!tracks) {
		return result;
	}
	tracks.forEach((track) => {
		const parsedTrack = parseTrack(track);
		if (parsedTrack !== null) {
			parsedTrack.confidence = 0.5;
			result.push(parsedTrack);
		}
	});
	return result;
}

function parseTrack(track) {

	//create data-items
	var item = track.description
	item.replace(/</g,'&lt;').replace(/>/g,'&gt;')
	var patt = /src="([^"]+)"/g
	var c2 = item.match(patt);
	console.log(c2)
	for (var j = 0, len2 = c2.length; j < len2; j++) {
		var turl = c2[j].substring(5,c2[j].length-1)
		var tobj = {'item': turl, 'tijd': '', 'pctitle': track.title};
		data.push(tobj)
	}
			
	return {
		type: 'track',
		id: track.guid,
		title: track.title,
		description: track.description,
		release_date: dateformat(track.pubdate, "yyyy-mm-dd"),
	}
}

function hmsToSecondsOnly(str) {
	if (str != null) {
		//console.log(str);
    var p = str.split(':'),
        s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
	s=s*1000
	//console.log(s);
	} else {s=null}
    return s;
}

module.exports = Slideshow;