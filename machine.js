var request = require('request');
var schedule = require('node-schedule');
var crypto = require('crypto');
var mysql  = require('mysql'); 

var connection ;
var redis = require('redis').createClient; 
var clientRedis = redis("6379", "10.34.0.*", { auth_pass: "" });
var mWord='hello',new_mWord=[];
const log4js = require('log4js');
const path   = require('path');
log4js.configure({
  	appenders: {
		cheeseLogs: { type: 'dateFile', filename: 'logs/date' ,alwaysIncludePattern:true,pattern: '-yyyy-MM-dd.log' },
		console: { type: 'console' }
	  },
	categories: {
		cheese: { appenders: ['cheeseLogs'], level: 'error' },
		another: { appenders: ['console'], level: 'trace' },
		default: { appenders: ['console', 'cheeseLogs'], level: 'trace' }
	}
});
const logger = log4js.getLogger(path.basename(__filename));

function handleError () {
		connection = mysql.createConnection({    
			  host     : '',      
			  user     : '',             
			  password : '',      
			  port: '3306',                  
			  database: '',
		});
		connection.connect(function (err) {
			if (err) {
				logger.info('error when connecting to db:', err);
				setTimeout(handleError , 2000);
			}
		});
		
		connection.on('error', function (err) {
				logger.info('db error', err);
				// auto reconnect
				if (err.code === 'PROTOCOL_CONNECTION_LOST') {
					handleError();
				} else {
					throw err;
				}
		});

}	
handleError();

	
var r = new schedule.RecurrenceRule(); 
r.second = [5,10,20,30,40,50,59];
var l = schedule.scheduleJob(r, function(){ 
	clientRedis.hgetall('machineConfig',function(error,res){
		if(!error ){ 
			new_mWord= res.newword ;
		}else{
			logger.info(error);
		}
	});

	clientRedis.lpop('recommendMachineQueue',function(error,res){
		if(!error ){ 
			if( res != null){
				var  userGetSql = 'SELECT * FROM cmf_machine_hot_list where status = 0 and uid = '+res;
				connection.query(userGetSql,function (err, result) {
						if(err){
							logger.info('[SELECT ERROR] - ',err.message);
							return;
						}
						if(result.length >0){ 
							doschedule(result[0].uid,result[0].m_num,result[0].m_total,new_mWord);
							request( "https://****/v3/public?service=User.removeRecMachine&uid="+result[0].uid,null); 
						}else{
							logger.info('normalMachineQueue : uid = ' +res);
						}	
				});
			}
		}else{
			logger.info(error);
		}
	});
	 
	//connection.end();
	
});	


function doschedule( roomnum,mNum,mTotal,new_mWord){
	var exetime = Math.floor(mTotal/mNum)  ;
	var new_exc_time =[];
	for(var m=0;m< mNum ;m++){	 
		new_exc_time[m] = Math.floor(60/mNum) * m + Math.floor(60/mNum) - 1 ;  
	} 
	var rule = new schedule.RecurrenceRule();  
	rule.second = new_exc_time;
	//rule.second = [10,20,30,40,50,59];
	var cur_total_num = 0;
	logger.info('new_exc_time : '+ new_exc_time+' ||  roomnum : '+roomnum+'  || mNum:'+ mNum+'  || mTotal:'+ mTotal);
	var k = schedule.scheduleJob(rule, function(){ 
		var new_mWord_arr = eval("("+new_mWord+")");
		var mWord = new_mWord_arr[random()]+""; 
		if(mWord == undefined){mWord='88';}
		if(mWord == 'undefined'){mWord='88';}

		logger.info('roomnum:'+ roomnum+'|| mNum:'+ mNum+'|| mTotal:'+ mTotal+'|| mWord:'+ mWord );	
		logger.info('cur_total_num== '+cur_total_num+' || mTotal='+mTotal);
		if( cur_total_num >= mTotal ){
			clientRedis.hlen(roomnum,function(error,res){
				if(!error ){ 
					if( res < mTotal ){
						logger.info('cur_total_num_from_redis less than mTotal then re-value cur_total_num= '+cur_total_num+'||cur_total_num_from_redis='+res);
						cur_total_num = res ;
					}
				}else{
					logger.info(error);
				}
			});
		}else{
			request('https://****/v3/public/?service=H5.index&showid='+roomnum+'&num=1', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var user = JSON.parse(body);
					var userArr = user.data;
					
					userinfo1 = JSON.parse(userArr[0]);
					//socket = require('socket.io-client')('http://****:80');
					socket = require('socket.io-client')('http://****:6007');
					socket.on('connect', function () {
							//logger.info('connect');
					});
					socket.emit('conn', {uid: userinfo1.data.info.uid, token: userinfo1.data.info.token, roomnum: roomnum,id: userinfo1.data.info.uid}); 		 
					cur_total_num = cur_total_num + 1;	
					if(userinfo1.data.info.uid % 5 == 0){
						socket.emit('broadcast',  "{\"msg\":[{\"uname\":\""+encodeUnicode(userinfo1.data.info.user_nicename)+"\" ,\"action\":\"0\",\"usign\":\"jjjjjjjj\",\"ugood\":\"17262\",\"roomnum\":\""+roomnum+"\",\"level\":\"1\",\"timestamp\":\"00:03\",\"equipment\":\"app\",\"uid\":\""+userinfo1.data.info.uid+"\",\"ct\":\""+encodeUnicode(mWord)+"\",\"touid\":\"17262\",\"_method_\":\"SendMsg\",\"msgtype\":\"2\",\"tougood\":\"\",\"uhead\":\"\",\"bullet\":\"0\", \"touname\":\"\"}],\"retmsg\":\"OK\",\"retcode\":\"000000\"}");
						request('http://appapi.bdzb.lntv.cn/v3/public/?service=User.sendGift&giftcount=1&giftid=26&token='+userinfo1.data.info.token+'&uid='+userinfo1.data.info.uid+'&touid='+roomnum, function (error, response, body) {
							if (!error && response.statusCode == 200) {
								var giftuser = JSON.parse(body);
									socket.emit('broadcast',  "{\"msg\": [{\"action\": \"0\",\"usign\": \"1\",\"evensend\": \"1\",\"ugood\": \"5\",\"giftcount\": \"1\",\"level\": \"1\",\"timestamp\": \"16:30\",\"equipment\": \"app\",\"uid\":\""+userinfo1.data.info.uid+"\",\"roomnum\": \"1855\",\"ct\":\""+giftuser.data.info.gifttoken+"\",\"touid\": \"\",\"_method_\": \"SendGift\",\"msgtype\": \"1\",\"tougood\": \"\",\"uhead\": \"\",\"touname\": \"\",\"uname\":\""+encodeUnicode(userinfo1.data.info.user_nicename)+"\"}],\"retmsg\": \"OK\",\"retcode\": \"000000\"}");
							}
						});
					} 
					socket.on('conn', function (data) {
						//logger.info('conn');
					});
					socket.on('broadcastingListen', function (data) {
						var data_str =  typeof data == 'object'?JSON.stringify(data):data;
						var dataObj  = typeof data == 'object'?data:JSON.parse(data);
						var action   = dataObj['msg'][0]['_method_'];
						switch(action){
							case 'KickUser' :{
								clientRedis.hdel(dataObj['msg'][0]['uid'],md5('beidouzhibo'+dataObj['msg'][0]['ct']),function(error,res){
									logger.info('disconnect'); 
									socket.disconnect();
									//socket.close();
								}); 
								break; 
							} 
						} 
					});
				}
			});
		}

		
	});
	setTimeout(function() {
        logger.info('stop schedule & total exetime '+ 60000*exetime);
        k.cancel();  
    }, 60000*(exetime+1));
	
}
function encodeUnicode(str) {  
    var res = [];  
    for ( var i=0; i<str.length; i++ ) {  
		res[i] = ( "00" + str.charCodeAt(i).toString(16) ).slice(-4);    
    }  
    return "\\u" + res.join("\\u");  
} 
function md5 (text) {
  return crypto.createHash('md5').update(text).digest('hex');
};
function random (text) {
	var a =Math.random();
	return Math.floor(a*10)+"";
};
function sleep(){
	var unixtime_ms = new Date().getTime();
	while(new Date().getTime() < unixtime_ms + 4000) {}
};