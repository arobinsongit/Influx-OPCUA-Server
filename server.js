var opcua = require("node-opcua");
var os = require("os");
var influx = require('influx');



// Let create an instance of OPCUAServer
var server = new opcua.OPCUAServer({
    port: 1234,        // the port of the listening socket of the server
    nodeset_filename: opcua.standard_nodeset_file
});

// we can set the buildInfo
server.buildInfo.productName = "InfluxDBOPCUAServer";
server.buildInfo.buildNumber = "0001";
server.buildInfo.buildDate = new Date(2016, 07, 03);

var influxClient = influx({
  // or single-host configuration
  host : 'localhost',
  port : 8086, // optional, default 8086
  protocol : 'http', // optional, default 'http'
  username : '',
  password : '',
  database : 'telegraf'
})
 
 //test client connection
influxClient.getMeasurements( function(err,arrayMeasurements){
    
    if(err)
    {
        console.log(err);
    }
    else
    {
    console.log("Measurements");
    
    //console.log(JSON.stringify(arrayMeasurements));
    
    arrayMeasurements[0].series[0].values.forEach(function(item){
        console.log(item[0]);
        }
    )
    
    console.log("")
    console.log("--------------")
    console.log("")
    console.log("")
    
    
    // for(var i in arrayMeasurements[0].series[0].values[0])
    // {
    //     console.log(arrayMeasurements[0].series[0].values[0][i]);
    // }
    
    // for (var i=0; i<arrayMeasurements.length; i++)
    // for (var name in arrayMeasurements[i]) {
    //     console.log("Item name: "+name);
    //     console.log("Source: "+arrayMeasurements[i][name].sourceUuid);
    //     console.log("Target: "+arrayMeasurements[i][name].targetUuid);
    // }
    
    }
    
 } 
 )


// the server needs to be initialized first. During initialisation,
// the server will construct its default namespace.
server.initialize(function () {

    console.log("initialized");

    // we can now extend the default name space with our variables
    construct_my_address_space(server);

    // we can now start the server
    server.start(function () {
        console.log("Server is now listening ... ( press CTRL+C to stop) ");
        var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        server.endpoints[0].endpointDescriptions().forEach(function (endpoint) {
            console.log(endpoint.endpointUrl, endpoint.securityMode.toString(), endpoint.securityPolicyUri.toString());
        });
    })

});


function construct_my_address_space(server) {

    var addressSpace = server.engine.addressSpace;

    // we create a new folder under RootFolder
    var myDevice = addressSpace.addFolder("ObjectsFolder", {browseName: "MyDevice"});
    
    
        influxClient.getMeasurements( function(err,arrayMeasurements){
        
        if(err)
        {
            console.log(err);
        }
        else
        {
        
        //console.log(JSON.stringify(arrayMeasurements));
        
            arrayMeasurements[0].series[0].values.forEach(function(item){
                
                var measurementName = item[0];
                console.log("Adding Device " + measurementName);
                var newMeasurement = addressSpace.addFolder("ObjectsFolder",{browseName: measurementName});
                
                    influxClient.query('SHOW FIELD KEYS FROM ' + measurementName, function (err, results) {
                        
                        //console.log(JSON.stringify(results));
                        //console.log("");
                       
                        results[0].forEach(function(fieldKeyItem){
                            //console.log(fieldKeyItem.fieldKey);                        
                        
                            var fieldKeyName =fieldKeyItem.fieldKey;
                             
                            server.nodeVariable1 = addressSpace.addVariable({
                            componentOf: newMeasurement,
                            browseName: fieldKeyName,
                            dataType: "Double",
                            value: {
                            get: function () {
                                
                                var t = new Date() / 10000.0;
                                //var value = variable1 + 10.0 * Math.sin(t);
                                
                                var newValue = 10.0 * Math.sin(t);
                                var newTimestamp;
                                              
                                influxClient.query('SELECT ' + fieldKeyName + ' from ' + measurementName + ' order by time desc limit 1', function (err, results, newValue, newTimestamp){
                                   
                                   if(err)
                                   {
                                       console.log(measurementName + ' :: ' + fieldKeyName);
                                       console.error(err);
                                       return new opcua.Variant({dataType: opcua.DataType.Double, value: -1});  
                                   }
                                   else
                                   {
                                        //console.log(JSON.stringify(results));
                                        console.log(measurementName + ' :: ' + fieldKeyName + ' :: ' + results[0][0].time + ' :: ' + results[0][0][fieldKeyName]);
                                        newValue = results[0][0][fieldKeyName];
                                        newTimestamp = results[0][0].time;
                                        
                                                                                  
                                   }                                                                                                  
                                });
                                
                                return new opcua.Variant({dataType: opcua.DataType.Double, value: newValue});                 
                                
                            }
                            }
                            });
                        
                        });
                                                
                    });
                

                
                
                }
            )
        }
        }
        )

    // now let's add first variable in folder
    // the addVariableInFolder
    var variable1 = 10.0;


    server.nodeVariable1 = addressSpace.addVariable({
        componentOf: myDevice,
        nodeId: "ns=2;s=Temperature",
        browseName: "Temperature",
        dataType: "Double",
        value: {
            get: function () {
                var t = new Date() / 10000.0;
                var value = variable1 + 10.0 * Math.sin(t);
                return new opcua.Variant({dataType: opcua.DataType.Double, value: value});
            }
        }
    });

    ///
    var variable2 = 10.0;

    server.nodeVariable2 = addressSpace.addVariable({
        componentOf: myDevice,
        browseName: "MyVariable2",
        dataType: "Double",
        value: {
            get: function () {
                return new opcua.Variant({dataType: opcua.DataType.Double, value: variable2});
            },
            set: function (variant) {
                variable2 = parseFloat(variant.value);
                return opcua.StatusCodes.Good;
            }
        }
    });


    server.nodeVariable3 = addressSpace.addVariable({
        componentOf: myDevice,
        nodeId: "ns=4;b=1020ffab", // some opaque NodeId in namespace 4
        browseName: "Percentage Memory Used",
        dataType: "Double",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                // var value = process.memoryUsage().heapUsed / 1000000;
                var percentageMemUsed = 1.0 - (os.freemem() / os.totalmem() );
                var value = percentageMemUsed * 100;
                return new opcua.Variant({dataType: opcua.DataType.Double, value: value});
            }
        }
    });

}
