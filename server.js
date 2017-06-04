var geolib = require('geolib/dist/geolib');
var fileSystem = require('fs')

var app = require('express')()
var http = require('http').createServer(app)
var io = require('socket.io')(http)
var port = process.env.PORT || 3000;

var currentRoom = 'Default'
var etobicoke = createPolygon('./boundaries/etobicoke.geojson')

var clients = []

http.listen(port, function(){
    console.log('listening at port %d', port)
})

app.get('/', function(req, res){
    res.sendFile(__dirname + '/main.html')
})

io.on('connection', function(socket){

    // clients.push(new Client(name: ))

    console.log('a user connected ' + socket.id)
    socket.join('Default')

    socket.on('location', function(coordinates){
        console.log('location receieved ' + coordinates.latitude + ' ' + coordinates.longitude + ' ' + socket.id)

        if (geolib.isPointInside(coordinates, etobicoke)){
            currentRoom = 'Etobicoke'
            socket.join(currentRoom)
        } else {
            currentRoom = 'Default'
            socket.join(currentRoom)
        }
        console.log(currentRoom)
    })

    // Send received message
    socket.on('chat message', function(msg){
        console.log('message ' + msg)
        io.to('Test room').emit('chat message', msg)
    })

    // Disconnection
    socket.on('disconnect', function(){
        console.log('user disconnected')
    })
})

function createPolygon(file) {
    // var isInside = geolib.isPointInside({"latitude": 43.614612, "longitude": -79.567578}, polygon)
    var fileText = fileSystem.readFileSync(file, 'utf8')
    var parsedData = JSON.parse(fileText)
    var polygon = []

    for (let coordinate of parsedData.features[0].geometry.coordinates[0]){
        var tempLat = coordinate[0]
        coordinate[0] = coordinate[1]
        coordinate[1] = tempLat

        polygon.push({"latitude": coordinate[0], "longitude": coordinate[1]})
    }

    return polygon
}