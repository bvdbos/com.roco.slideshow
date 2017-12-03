'use strict';

const Homey = require('homey');
const dateformat = require('dateformat');
var FeedMe = require('feedme');
var http = require('http');
var https = require('https');
var urllist = []; //array with {name,url,latestbroadcast,latesturl,token} feeds from settings
var data = []; //name with image-urls
var playlist = []; //array of playlists
var total = 0
var tokenval 
var refreshIntervalId
var statusplay
let triggercard

class Slideshow extends Homey.App {	
	onInit() {
		Homey.app.log('Slideshow starting');
		
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
				
		let randomPlayAction = new Homey.FlowCardAction('random_play');
			randomPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					var pauze = args.pauze;
					if (statusplay = true) {
						clearInterval(refreshIntervalId)
					}
					randomplay(pauze);
					statusplay = true
					let isStarted = true; // true or false
					return Promise.resolve( isStarted );
				});
				
		Homey.ManagerSettings.on('set', function(settings) {
			getsettings().then(function(settings) {
				urllist=settings;
				Homey.app.log(urllist)
				readfeeds().then(function(results) {
					Homey.app.log("feeds read from changing settings");
					playlist=results;
				})		
			});
		});

		getsettings().then(function(settings) {
			Homey.app.log("initial settings read");
			urllist=settings;
			Homey.app.log(urllist);
			readfeeds().then(function(results) {
				playlist=results;
				Homey.app.log("initial playlist and data read")
				Homey.app.log("data is ", data.length)
			})
		})
	}
}

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
			newlist.forEach(function(listobject) {
				var objIndex = urllist.findIndex(obj => obj.url == listobject.url);
				Homey.app.log ("objIndex ", objIndex, "in urllist voor ",listobject.url);
				//if it exists then take it's settings
				if (objIndex > -1) {
					Homey.app.log("gegevens overnemen");
					listobject.latestbroadcast = urllist[objIndex].latestbroadcast;
					listobject.latesturl = urllist[objIndex].latesturl;
				//if it doesn't exist then create items
				} else {
					listobject.latestbroadcast = null;
					listobject.latesturl = "";
				}
			});
			
			Homey.app.log("newlist created")
			Homey.app.log(newlist)
			Homey.app.log("now lets delete items which should be deleted")
			
			//were items deleted?
			if (urllist.length > 0) {
				urllist.forEach(function(listobject) {
					Homey.app.log("listobject from old urllist")
					Homey.app.log(listobject)
					var objIndex = newlist.findIndex(obj => obj.url == listobject.url);
					Homey.app.log("listobject in old list ", objIndex);
					if (objIndex < 0) {
						Homey.app.log("an item from oldlist is not in the new list")
					} else {
						Homey.app.log("an item from oldlist is also in the new list")
					}
				});
			}
			Homey.app.log("so now we have a newlist array")
			resolve(newlist)
		}
	})
}	


function play (pauze) {
	var total = data.length;
	var counter = 0;	
	Homey.app.log("play all, items ", total)
	refreshIntervalId = setInterval(() => {
		if (counter > total-1) { counter = 0; }
		Homey.app.log (counter)
		Homey.app.log (data[counter])
		tokenval.setValue(data[counter].item);
		triggercard.trigger(data[counter]);
		counter = counter+1;
	}, pauze * 1000);
}

function randomplay (pauze) {
	var total = data.length;
	var counter = 0
	Homey.app.log("play random, items ", total)
	refreshIntervalId = setInterval(() => {
		counter=getRandomInt(0,total-1)
		Homey.app.log (counter)
		Homey.app.log (data[counter])
		tokenval.setValue(data[counter].item);
		triggercard.trigger(data[counter]);
		counter = counter+1;
	}, pauze * 1000);
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

async function readfeeds() {
		var temparray = [];
		for(var i = 0; i < urllist.length; i++) {
				var obj = urllist[i];
				Homey.app.log("readfeed ", obj.url);
				var item = await readfeed(obj.url);
				temparray.push (item);
		};
		return temparray;
};
	
function readfeed(feedurl) { //returns an array of playlists
	return new Promise(resolve => {
			https.get(feedurl, function(res) {
				var parser = new FeedMe(true);
				var teller=0;
		
				/*
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == url));
						Homey.app.log(objIndex);
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
								Homey.app.log(tokens);
								//Homey.app.log(urllist[objIndex].flowTriggers.newvodcast);
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
					Homey.app.log("parser ended")
					var pl = parser.done();
					Homey.app.log("parser.done")
					//Homey.app.log(pl)
					var result = {
						type: 'photolist',
						url: feedurl,
						id: pl.title,
						title: pl.title,
						tracks: parseTracks(pl.items) || false,
					};
					
				parser.on('error', err => { Homey.app.log(err) })
				
				resolve(result);
				});	
			});		
	}
	
	
	);
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
	Homey.app.log(c2)
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