$(document).ready(function() {
	var targetUrl='service:jmx:rmi:///jndi/rmi://'+targetIp+':'+targetPort+'/jmxrmi'
	var factory = new JmxChartsFactory();
	//系统属性
	factory.renderPropertiesData([
	         {  id:'InputArgumentsContainer',
	        	name:'java.lang:type=Runtime',
		        attribute: 'InputArguments',
		    	type: "read",
		    	target: {url: targetUrl}	
		     },{
		    	 id:'SystemPropertiesContainer',
		    	 name:'java.lang:type=Runtime',
			     attribute: 'SystemProperties',
			     type: "read",
			     target: {url: targetUrl}	
			 }])
	//内存
	debugger;
	factory.create([
		{
			id:'memoryUsedContainer',
			name: 'java.lang:type=Memory',
			attribute: 'HeapMemoryUsage',
			path: 'committed',
			showWhere:'graph',//表示显示在哪里，目前'graph'表示显示在图上面，’title'表示显示在图形上面，‘both表示两处都显示`
			target: {url: targetUrl}	
		},
		{
			name: 'java.lang:type=Memory',
			attribute: 'HeapMemoryUsage',
			path: 'used',
			showWhere:'graph',
			target: {url: targetUrl}	
		},{
			name: 'java.lang:type=Memory',
			attribute: 'HeapMemoryUsage',
			path: 'max',
			showWhere:'title',
			target: {url: targetUrl}	
		},{
			name: 'java.lang:type=Memory',
			attribute: 'HeapMemoryUsage',
			path: 'init',
			showWhere:'title',
			target: {url: targetUrl}	
		}
	]);
	//类加载,已经加载类数量，没有加载的类数量，总的类数量
	factory.create([
	        {
	        	id:'classLoadedContainer',
		        name:'java.lang:type=ClassLoading',
		        attribute: 'LoadedClassCount',
		        target: {url: targetUrl}	
    		},
    		{
		        name:'java.lang:type=ClassLoading',
		        attribute: 'UnloadedClassCount',
		        target: {url: targetUrl}	
		     },
		     {
    		     name:'java.lang:type=ClassLoading',
    		     attribute: 'TotalLoadedClassCount',
    		     target: {url: targetUrl}	
    		 }
	    ]);
	//元数据
	var metaOrPergen='Metaspace';
    if(factory.javaVersion<1.8){
      metaOrPergen='PS Perm Gen';
	  $("#metaOrPergen").html('PS Perm Gen');
	}
	factory.create([{
		                id:'metaspaceContainer',
	        			name: 'java.lang:type=MemoryPool,name='+metaOrPergen,
	        			attribute: 'Usage',
	        			path: 'committed',
	        			showWhere:'graph',
	        			target: {url: targetUrl}	
	        		},{
		                id:'metaspaceContainer',
	        			name: 'java.lang:type=MemoryPool,name='+metaOrPergen,
	        			attribute: 'Usage',
	        			path: 'used',
	        			showWhere:'graph',
	        			target: {url: targetUrl}	
	        		},{
		                id:'metaspaceContainer',
	        			name: 'java.lang:type=MemoryPool,name='+metaOrPergen,
	        			attribute: 'Usage',
	        			path: 'max',
	        			showWhere:'title',
	        			target: {url: targetUrl}	
	        		},{
		                id:'metaspaceContainer',
	        			name: 'java.lang:type=MemoryPool,name='+metaOrPergen,
	        			attribute: 'Usage',
	        			path: 'init',
	        			showWhere:'title',
	        			target: {url: targetUrl}	
	        		}]);
			 
	factory.renderThreadGraph(targetUrl);
});


function showStackTrace(index){
	//$('.stackTrace').attr("style","display:none");
	var st=$('#stackTrace'+index).attr("style");
	if(st=="display:none"){
		$('#stackTrace'+index).attr("style","display:block");
	}else{
		$('#stackTrace'+index).attr("style","display:none");
	}

}

function JmxChartsFactory(keepHistorySec, pollInterval, columnsCount) {
	var javaVersion=1.8;
	var changeStepWidthFlag=0;//线程监控图当统计次数达到100*（10的n次方倍的时候，n为整数）stepWidth变为原来的1/(10的n次方)
	var threadsInfo=[];
	var stepWidth=6;//线程监控图
	var doWhat=1;
	var jolokia = new Jolokia(OSVHost + "/jolokia");
	var series = [];
	var monitoredMbeans = [];
	var chartsCount = 0;
	var graphBeans=[];
	var titleBeans=[];
	columnsCount = columnsCount || 2;
	pollInterval = pollInterval || 1000;
	var keepPoints = (keepHistorySec || 600) / (pollInterval / 1000);
	Highcharts.setOptions({
	    global: {
	        useUTC: false
	    }
	});
	var self=this;
	self.javaVersion=javaVersion;
	//setupPortletsContainer(columnsCount);

	setInterval(function() {
		pollAndUpdateCharts();
	}, 2000);

	this.create = function(mbeans) {
		mbeans = $.makeArray(mbeans);
		//mbeans：有三种1.渲染图表2.渲染表title 3.两者都渲染	
		mbeans.forEach(function(item){
			if(!item.showWhere||item.showWhere=='graph'){
				    graphBeans.push(item);
			}else{
				if(item.showWhere=='both'){
					graphBeans.push(item);
					titleBeans.push(item);
				}else if(item.showWhere=='title'){
					titleBeans.push(item);
				}
			}
		})
		series = series.concat(createChart(mbeans).series);
		monitoredMbeans = monitoredMbeans.concat(mbeans);
	};

	function pollAndUpdateCharts() {
		var requests = prepareBatchRequest();
		var responses = jolokia.request(requests);
		updateCharts(responses);
	}

	function prepareBatchRequest() {
		return $.map(monitoredMbeans, function(mbean) {
			return {
				type: "read",
				mbean: mbean.name,
				attribute: mbean.attribute,
				path: mbean.path,
				target:mbean.target
			};
		});
	}
 
	//原本设计没有更新非图表字段，现在除了图表显示的信息之外还要显示图表title信息
	function updateCharts(responses) {
		var curChart = 0;
		$.each(responses, function() {
			var point = {
				x: this.timestamp * 1000,
				y: parseFloat(this.value)
			};	
			//渲染图表
			if(!this.request.path||(this.request.path!='max'&&this.request.path!='init')){
	            var curSeries = series[curChart++];
				if(this.request.path){
					point.y=Math.round(100*this.value/1024/1024)/100;
				}
			    curSeries.addPoint(point, true, curSeries.data.length >= keepPoints);
			}
			//渲染title
			if(this.request.path){
               if(this.request.path=='max'){
            	   if(this.value==-1){
            		   $("#"+this.request.attribute+'Max').html('未配');
            	   }else{
            		   $("#"+this.request.attribute+'Max').html(Math.round(100*this.value/1024/1024)/100+'M');
            	   }
			   }else if(this.request.path=='init'){
				   $("#"+this.request.attribute+'Init').html(Math.round(100*this.value/1024/1024)/100+'M');
			   }else if(this.request.path=='committed'){
				   $("#"+this.request.attribute+'Committed').html(Math.round(100*this.value/1024/1024)/100+'M');
			   }
			}else{
                  $("#"+this.request.attribute).html(this.value);
			}
		});
	}
	function createChart(mbeans) {
		return new Highcharts.Chart({
			chart: {
				renderTo: mbeans[0].id,
				animation: false,
				type: 'line',
				shadow: false
			},
			title: { text: null },
			xAxis: { 
				type: 'datetime',
				dateTimeLabelFormats: {
						day: '%Y-%m-%d'
					}
				 },
			yAxis: {
				title: { text: null }
			},
			legend: {
				enabled: true,
				borderWidth: 0
			},
			credits: {enabled: false},
			exporting: { enabled: false },
			plotOptions: {
				area: {
					marker: {
						enabled: false
					}
				}
			},
			series: $.map(mbeans, function(mbean) {
				if(!mbean.showWhere||mbean.showWhere=='graph'||mbean.showWhere=='both'){
					return {
						data: [],
						name: mbean.path || mbean.attribute
					}	
				}		
			})
		})
	}
		//获取输入参数和系统参数
	this.renderPropertiesData=function renderPropertiesData(mbeans){
		var requests= $.map(mbeans, function(mbean) {
			return {
				type: "read",
				mbean: mbean.name,
				attribute: mbean.attribute,
				path: mbean.path,
				target:mbean.target
			};
		});
	   var responses = jolokia.request(requests);
	   responses.forEach(function(item){
		   var id=item.request.attribute+'Container';
		   var values=item.value;
		   var html='<ul>'
		   if(values instanceof Array){
			   values.forEach(function(it){
				   html+='<li>'+it+'</li>';
			   })
		   }else{
			   for(var key in values){
				   if(key=='java.version'){
                      javaVersion= values[key].substring(0,3);
					  self.javaVersion=javaVersion;
				   }
				   html+='<li>'+key+":"+ values[key]+'</li>';
			   }
		   }
		   $("#"+id).html(html+'</ul>');
	   })	   
	 }
	
	//渲染Thread图形
	this.renderThreadGraph=function(targetUrl){
		var mbeans= {
			mbean: "java.lang:type=Threading",
			type: "read",
			target: {url: targetUrl}	
		}
	   var responses = jolokia.request(mbeans);
	   var threadCount=responses.value.ThreadCount;//线程数
	   var daemonThreadCount=responses.value.DaemonThreadCount;//守护线程数
	   $("#threadCount").html(threadCount);
	   $("#daemonThreadCount").html(daemonThreadCount);
	   var threadIds=responses.value.AllThreadIds;
	   setInterval(function() {
		   getThreadsInfo(threadIds); 
		   changeStepWidthFlag++;
		}, 2000);
	}
	
	function getThreadsInfo(threadIds){
		var mbeans=[];
		if(threadIds){
			threadIds.forEach(function(id){
				var c={
						 type:"EXEC",
						 mbean:"java.lang:type=Threading",
						 operation:"getThreadInfo(long,int)",
						 arguments:[id,99]
						}
				mbeans.push(c);
			})
		}	
		var responses=jolokia.request(mbeans);
		if(doWhat==1){
			renderThreadTable(responses);
			doWhat++;
		}else{
			renderThreadGraphUI(responses);
		}
		 changeStepWidth();
		//showOverflowX();
	}
	//第一次执行的时候渲染表格数据，同时绘制表格图形
	function renderThreadTable(responses){
		var html="";
		responses.forEach(function(item,index){
			if(item.value!=null){
			var thread={threadName:'',runningTime:'',totalTime:'',lastUnchangeStatus:'',lastUnchangeStatusTime:'',beginTime:''};		
			html+="<tr>";
			var threadName=item.value.threadName;
			thread.threadName=threadName;
			thread.lastUnchangeStatus=item.value.threadState;
			thread.lastUnchangeStatusTime=item.timestamp;//上一次unchange 状态时间
			thread.beginTime=item.timestamp;//上一次开始时间
			thread.totalTime=0;//统计总时间
			thread.runningTime=0;//运行时间
			threadsInfo[index]=thread;
			//名称
			html+='<td><span class="thread_td_span" <a href="javascript:void(0)" onclick="showStackTrace('+index+')">'+threadName+'</a></span></td>';
			//状态
			html+='<td class="table_td_div1">'+
			         '<div class="table_td_div2">'+
			            '<div id="threadState'+index+'" class="thread_background"> </div>	'+
			        '</div></td>';
			   
			//运行
			html+='<td id="runTime'+index+'">0.00ms</td>';
			//总计
			html+='<td id="totalTime'+index+'">0.00ms</td>';
			html+="</tr>";
			html+='<tr><td colspan="4"><div style="display:none" class="stackTrace" id="stackTrace'+index+'">';
			html+='<p class="p_title">'+threadName+'</p>';
			var stackTrace=item.value.stackTrace;
			stackTrace.forEach(function(it){
				html+='<p>at '+it.className+'.'+it.methodName+'';
				var lineNumber=it.lineNumber;
				if(lineNumber<0){
					html+='(Native Method)</p>'
				}else{
					html+='('+it.fileName+':'+it.lineNumber+')</p>'
				}
			})
			html+='</div></td></tr>'			
			}
			
		})
		$("#threadTableBody").html(html);	
	}
	function renderThreadGraphUI(responses){
		var html="";
		responses.forEach(function(item,index){	
			if(item.value!=null){
					var state=item.value.threadState;
					//#4DD52B  绿色  运行　　RUNNABLE
					//#1A1AE6     蓝色  休眠           SLEEPING
					//#EEC211     黄色   等待          WAITING
					//#D56F2B  橙色   驻留          TIMED_WAITING 
					//#FF0033     红色   监视           WATCHING  待定
					var color='';
					threadsInfo[index].totalTime=item.timestamp-threadsInfo[index].beginTime;
					if(state=='RUNNABLE'){
						color='#4DD52B';
						threadsInfo[index].lastUnchangeStatusTime;	
						if(threadsInfo[index].lastUnchangeStatus=='RUNNABLE'){
							//获取当前未改变的时间
							threadsInfo[index].runningTime+=item.timestamp-threadsInfo[index].lastUnchangeStatusTime;	
						}else{
							threadsInfo[index].lastUnchangeStatus='RUNNABLE';
						}
						threadsInfo[index].lastUnchangeStatusTime=item.timestamp;//每次的上次状态是运行的时间
					}
					if(state=='SLEEPING'){
						if(threadsInfo[index].lastUnchangeStatus=='RUNNABLE'){
							//获取当前未改变的时间
							threadsInfo[index].lastUnchangeStatus='SLEEPING';
						}
						color='#1A1AE6';
					}
					if(state=='WAITING'){
						if(threadsInfo[index].lastUnchangeStatus=='RUNNABLE'){
							//获取当前未改变的时间
							threadsInfo[index].lastUnchangeStatus='WAITING';
						}
						color='#EEC211';
					}
					if(state=='TIMED_WAITING'){
						if(threadsInfo[index].lastUnchangeStatus=='RUNNABLE'){
							//获取当前未改变的时间
							threadsInfo[index].lastUnchangeStatus='TIMED_WAITING';
						}
						color='#1A1AE6';
					}
					if(state=='WATCHING'){
						if(threadsInfo[index].lastUnchangeStatus=='RUNNABLE'){
							//获取当前未改变的时间
							threadsInfo[index].lastUnchangeStatus='WATCHING';
						}
						color='#FF0033';
					}
					html='<div class="abc" style="height:30px;width:'+stepWidth+'px;display:inline-block;background-color:'+color+';"></div>';
					$("#threadState"+index).append(html);
					$("#runTime"+index).html(threadsInfo[index].runningTime);
					$("#totalTime"+index).html(threadsInfo[index].totalTime);
							
					}
		  })
	}
	
	//对于当线程统计时间轴线超出的时候，我们提供两种操作1:提供航向进度条  2，修改列宽（统计次数达到100次时宽度变为原来的1/10
	
	function showOverflowX(){
		if(changeStepWidthFlag>100){
			$(".thread_background").attr("style",function(){	
				this.style.width=6*changeStepWidthFlag+"px";
				//this.scrollLeft=6*changeStepWidthFlag;
			})
    		$(".table_td_div2").attr("style",function(){
				this.scrollLeft=6*changeStepWidth;
			})
	    }
	}
	
	function changeStepWidth(){
		if(changeStepWidthFlag%100==0&&changeStepWidthFlag!=0){
			var c=changeStepWidthFlag/10;
	    	var n=Math.log(c)/Math.log(10);
	    	if(n%1 === 0){
	    		stepWidth*=1/c;//每次增加的宽度变为原来的1/c 
	    		$(".abc").attr("style",function(){
					this.style.width=stepWidth+"px";
				})
	    	}
		}
	}
	
}
