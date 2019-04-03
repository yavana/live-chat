
//引入http模块

/*

#服务器
var io = require('socket.io')(httpServer,{
   "serveClient": false ,
   "transports":['websocket', 'polling']
 });
#客户端
var socket = require('socket.io-client')('http://localhost/chat',   {
  "transports":['websocket', 'polling']
});
*/

var socketio = require('socket.io'),
	http     = require('http'),
	domain   = require('domain'),
	log4js   = require('log4js'),
	 
    request  = require('request'),
    path     = require('path'),
    config   = require('./config.js');
	
	
	 log4js.configure({
		appenders:[
			{
                "type":"console",
                "category":"console"
            },
			{type:'dateFile',filename:'logs/date',alwaysIncludePattern:true,pattern: '-yyyy-MM-dd.log'}
			
		],
		replaceConsole: true
	});



var Logger = log4js.getLogger(path.basename(__filename));
var d = domain.create();
d.on("error", function(err) {
	console.log(err);
	Logger.error(err);
}); 
	

var server = http.createServer(function(req, res) {
	res.writeHead(200, {
		'Content-type': 'text/html'
	});

	res.end();
}).listen(6005, function() {
	console.log('服务开启6005');
});
	
var io = socketio.listen(server);

 
var redis = require('redis').createClient;
var adapter = require('socket.io-redis');
var clientRedis = redis(config['REDISPORT'], config['REDISHOST'], { auth_pass: "" });
var pub = redis(config['REDISPORT'], config['REDISHOST'], { return_buffers: true, auth_pass: "" });
io.adapter(adapter({ pubClient: clientRedis, subClient: pub })); 
 
//io.adapter(redisio({ host: config['REDISHOST'], port: config['REDISPORT'] }));


io.set('heartbeat interval',2000); 
io.set('heartbeat timeout',5000);
io.on('connection', function(socket) {
	console.log('connected success 6005');
	//进入房间
	socket.on('conn', function(data) {
		console.log("get into room"); 
		clientRedis.get(data.token,function(error,res){
			console.log("clientRedis success"); 
			if(error){
				console.log("[get token failed]");
			}else{
				console.log("[redis token value is]"+data.token +"---"+data.uid);
				console.log(res);
				if(res != null){
					var userInfo = evalJson(res);
					if(userInfo['id'] == data.uid ){
						console.log("[init verify successed]"+Date.parse(new Date()));
						//获取验证token
						socket.token   = data.token;
						socket.sign    = userInfo['sign'];
						socket.roomnum = data.roomnum;
						socket.uType   = parseInt(userInfo['userType']);
						socket.uid     = data.uid;
						socket.join(data.roomnum);
						socket.emit('conn','ok');
						if(socket.roomnum!=socket.uid){
							clientRedis.hlen(data.roomnum,function (err, data_num) {
								data_num = data_num +1 ;
								socket.broadcast.to(socket.roomnum).emit('broadcastingListen',"{\"msg\":[{\"_method_\":\"SendMsg\",\"roomnumber\":\""+data_num+ "\",\"action\":\"0\",\"ct\":{\"id\":\""+userInfo['id']+"\",\"user_nicename\":\""+userInfo['user_nicename']+"\",\"avatar\":\""+userInfo['avatar']+"\",\"sex\":\""+userInfo['sex']+"\",\"signature\":\""+userInfo['signature']+"\",\"province\":\""+userInfo['province']+"\",\"city\":\""+userInfo['city']+"\",\"level\":\""+userInfo['level']+"\"},\"msgtype\":\"0\",\"timestamp\":\""+new Date().getHours()+":"+new Date().getMinutes()+"\",\"tougood\":\"\",\"touid\":\"\",\"touname\":\"\",\"ugood\":\""+userInfo['goodnum']+"\",\"uid\":\"\",\"trueuserid\":\"\",\"uname\":\"\"}],\"retcode\":\"000000\",\"retmsg\":\"OK\",\"roomnum\":\"" + socket.roomnum + "\"}");
							});
							console.log(socket.roomnum+"----"+socket.sign+"----"+socket.token+"----"+socket.uid);
							/* 观众 */
							clientRedis.hset(socket.roomnum,socket.sign,res,redis.print);
							request(config['WEBADDRESS']+"?service=User.updateRoomnum&uid="+socket.roomnum+"&type=1",null);
						}
						return;
					}else{
						console.log("[init verify failed]");
					}
				}
			}
			socket.emit('conn','no');
		});
	});
	socket.on('broadcast',function(data){
		    if(socket.token != undefined){
		    	var dataObj  = typeof data == 'object'?data:evalJson(data);
			    var msg      = dataObj['msg'][0]; 
			    var token    = dataObj['token'];
			    var action   = msg['_method_'];
			    var data_str =  typeof data == 'object'?JSON.stringify(data):data;
			    switch(action){
			    	case 'SendMsg':{     //聊天
						if(socket.uid == undefined){
							return;
						}
						clientRedis.get("allShutupList",function(error,res){
							if(error){
								console.log("[get allShutupList failed]");
							}else{ 
								if(res != null ){ //不为空则设置了全局禁言
									console.log("allShutupList" );
									return;
								}
							}				 
							clientRedis.hexists("shutupList",socket.roomnum,function(error,res){
								if(res == 0){ 
									clientRedis.hget(socket.roomnum + "shutup",socket.uid,function(error,res){
										if(error) return;
										if(res != null){
											var time = Date.parse(new Date())/1000;
											console.log("now time:" + time + "shutuptime:" + res +　"= " +(time - parseInt(res)));
											if((time - parseInt(res))<300){
												var newData  = dataObj;
												newData['retcode'] = '409002';
												socket.emit('broadcastingListen',JSON.stringify(newData));
											}else{//解除禁言
												clientRedis.del(socket.roomnum + "shutup",socket.uid,redis.print);
											}
											
										}else{
											io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
										}
									});
								}else{
									console.log("shutuplist"+socket.roomnum );		 
									return
								}
							});
						});
			    		break;
			    	}
			    	case 'SendGift':{    //送礼物
						var gifToken = dataObj['msg'][0]['ct'];
			    		clientRedis.get(gifToken,function(error,res){
			    			if(!error&&res != null){
			    				var resObj = evalJson(res);
			    				dataObj['msg'][0]['ct'] = resObj;
			    				io.sockets.in(socket.roomnum).emit('broadcastingListen',JSON.stringify(dataObj));
			    				clientRedis.del(gifToken,redis.print);
			    			}
			    		});
			    		break;
			    	}
			    	case 'SendFly' :{    //飞屏
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		//clientRedis.get(socket.uid + 'SendFly',function(error,res){
			    		//	if(!error&&res == '1'){
			    		//		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		//		clientRedis.del(socket.uid + 'SendFly',redis.print);
							//	console.log("sendflyend  "+data_str);
			    		//	}else{
			    		//		Logger.error("[飞屏err]"+error);
			    		//	}
                        //
			    		//});
	                    break;
			    	}
			    	case 'fetch_sofa' :{ //抢座
			    		clientRedis.get(socket.uid + 'fetch_sofa',function(error,res){
			    			if(!error&&res == '1'){
			    				io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    				clientRedis.del(socket.uid + 'fetch_sofa',redis.print);
			    			}else{
			    				Logger.error("[抢沙发err]"+error);
			    			}
			    		});
	                    break;
			    	}
			    	case 'SendTietiao' :{ //贴条
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
	                    break;
			    	}
			    	case 'SendHb' :{      //送红包
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
	                    break;
			    	}
			    	case 'VodSong' :{     //点歌
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
	                    break;
			    	}
			    	case 'SetBackground' :{//设置背景
			    		if(socket.uType == 50){
			    			io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		}
	                    break;
			    	}
			    	case 'CancelBackground' :{//取消背景
			    		if(socket.uType == 50){
			    		    io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    	    }
	                    break;
			    	}
			    	case 'AgreeSong' :{//同意点歌
			    		if(socket.uType == 50){
			    		    io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    	    }
	                    break;
			    	}
			    	case 'SubmitBroadcast' :{//广播
			    		clientRedis.get(socket.uid + 'SubmitBroadcast',function(error,res){
			    			if(!error&&res == '1'){
			    				io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    				clientRedis.del(socket.uid + 'SubmitBroadcast',redis.print);
			    			}
			    			
			    		});
	                    break;
			    	}
			    	case 'MoveRoom' :{//转移房间
			    		if(socket.uType == 50 || socket.uType == 40){
			    		    io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    	    }
	                    break;
			    	}
			    	case 'SetchatPublic' :{//开启关闭公聊
			    		if(socket.uType == 50 || socket.uType == 40){
			    		    io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);			    	    
						}
	                    break;
			    	}
			    	case 'CloseLive' :{//关闭直播
			    		if(socket.uType == 50 || socket.uType == 40){
			    		    io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    	    }
	                    break;
			    	}
					case 'CloseLiveByAdmin' :{//关闭直播
							io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
			    	case 'SetBulletin' :{//房间公告
			    		
	                    if(socket.uType == 50 || socket.uType == 40){
	                        io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		}
						io.sockets.emit('broadcastingListen',data_str);
						console.log("SetBulletin  ");
	                    break;
			    	}
			    	case 'NoticeMsg' :{//全站礼物
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
	                    break;
			    	}
			    	case 'KickUser' :{//踢人
						console.log('KickUser');
						console.log(data_str);
						if(socket.uid == 1){
							io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						}else{
							if(socket.uType == 50 || socket.uType == 40){
			    	    	io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
							} 
						}
						break;
			    		
			    	}
			    	case 'ShutUpUser' :{//禁言
						console.log('ShutUpUser');
						if(socket.uid == 1){
							io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						}else{
							if(socket.uType == 50 || socket.uType == 40){
								io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
							}
						} 
	                    break;
			    	}
			    	case 'SendPrvMsg' :{//私聊
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
	                    break;
			    	}
			    	case 'ResumeUser' :{//恢复发言
			    		if(socket.uType == 50 || socket.uType == 40){
			    		    io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    	    }
			    	    break;

			    	} 
			    	case 'StartEndLive':{ 
			    		console.log('开始关闭直播')
			    		if(socket.uType == 50 ){
			    		   socket.broadcast.to(socket.roomnum).emit('broadcastingListen',data_str);
			    	    }else{
			    	    	clientRedis.get("LiveAuthority" + socket.uid,function(error,res){
			    	    		if(error) return;
			    	    		if(parseInt(res) == 5 ||parseInt(res) == 1 || parseInt(res) == 2){
		    	    				socket.broadcast.to(socket.roomnum).emit('broadcastingListen',data_str);
		    	    			}
			    	    	})
			    	    }
			    	    break;

			    	}
			    	case 'RowMikeFromAnchor':{//排麦
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		break;
			    	}
			    	case 'RowMikeFromAudience':{//排麦
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		break;
			    	}
			    	case 'RowMike':{//排麦
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		break;
			    	}
			    	case 'OpenGuard':{//购买守护
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		break;
			    	}
			    	case 'SystemNot':{//系统通知
			    		io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
			    		break;
			    	}

					case 'AttRemind':{//关注提醒
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
					case 'GetIntoRoom':{//进入直播间
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
					case 'LikeRemind':{//点赞提醒
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
					case 'ShareRemind':{//分享提醒
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
					case 'LeaveWhile':{//分享提醒
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
					case 'DoShutUp':{//分享提醒
						io.sockets.in(socket.roomnum).emit('broadcastingListen',data_str);
						break;
					}
			    }
		    }
		    
	});
    //资源释放
	socket.on('disconnect', function() { 
			d.run(function() {
				if(socket.roomnum == undefined){
					return;
				}
				clientRedis.hget(socket.roomnum,socket.sign,function(error,res){
					if(error) return;
					if(res != null){
						var user = JSON.parse(res);
						clientRedis.hlen(socket.roomnum,function (err, data_num) {
							data_num = data_num -1 ;
							if(data_num < 0){
								data_num = 0;
							}
							io.sockets.in(socket.roomnum).emit('broadcastingListen',"{\"msg\":[{\"_method_\":\"disconnect\",\"roomnumber\":\""+data_num+ "\",\"action\":\"1\",\"ct\":{\"id\":\""+user['id']+"\",\"user_nicename\":\""+user['user_nicename']+"\",\"avatar\":\""+user['avatar']+"\",\"sex\":\""+user['sex']+"\",\"signature\":\""+user['signature']+"\",\"province\":\""+user['province']+"\",\"city\":\""+user['city']+"\",\"level\":\""+user['level']+"\"},\"msgtype\":\"0\",\"timestamp\":\""+new Date().getHours()+":"+new Date().getMinutes()+"\",\"tougood\":\"\",\"touid\":\"\",\"touname\":\"\",\"ugood\":\""+user['goodnum']+"\",\"uid\":\"\",\"trueuserid\":\"\",\"uname\":\"\"}],\"retcode\":\"000000\",\"retmsg\":\"OK\",\"roomnum\":\"" + socket.roomnum + "\"}"); 
						});
					}
					clientRedis.hdel(socket.roomnum,socket.sign,redis.print);
					if(socket.roomnum==socket.uid){
					}else{
						/* 观众 */
						request(config['WEBADDRESS']+"?service=User.updateRoomnum&uid="+socket.roomnum+"&type=0",null);
					}
				});
				clientRedis.del(socket.token,redis.print);
				socket.leave(socket.roomnum);
				console.log("离开广播");
			});
	});

});

/*  io.sockets.on('disconnect', function(socket) {
   			console.log("离开广播222");			
			console.log(socket.roomnum);			
			console.log(socket.sign);    
})  */

function evalJson(data){
	return eval("("+data+")");
}

//时间格式化
function FormatNowDate(){
		var mDate = new Date();
		var H = mDate.getHours();
		var i = mDate.getMinutes();
		var s = mDate.getSeconds();
		return H + ':' + i + ':' + s;
}