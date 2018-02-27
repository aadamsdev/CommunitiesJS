const Geofence = require('../geo/geofence')
const GeofenceManager = require('../geo/geofenceManager')
const SocketEvents = require('../config/socketEvents')
const ChatHistoryDao = require('../dao/chatHistoryDao')
const UserStatusDao = require('../dao/userStatusDao')

let instance = null

class ChatSocket {

    constructor() {
        if (instance) {
            return instance
        }

        instance = this
        instance.geofenceManager = new GeofenceManager('./boundaries/neighbourhoods.json')
    }

    registerSocketEvents(io, db) {
        io.on(SocketEvents.connection, (socket) => {
            console.log('a user connected ' + socket.id)

            // Client location update
            socket.on(SocketEvents.location_update, (locationUpdate) => {
                console.log(locationUpdate)

                // Check if client is in previously known geofence; for performance purposes
                if (locationUpdate.lastKnownChatRoom
                    && instance.geofenceManager.contains(locationUpdate.lastKnownChatRoom)
                    && instance.geofenceManager.getGeofence(locationUpdate.lastKnownChatRoom).containsPoint(locationUpdate)) {

                    const chatRoom = locationUpdate.lastKnownChatRoom
                    const username = 'Andrew'
                    instance.onLocationUpdated(db, io, username, socket, chatRoom)
                } else { // Otherwise loop find the geofence containing user's location
                    const geofence = instance.geofenceManager.getGeofenceContainingPoint(locationUpdate)
                    if (geofence) {
                        const chatRoom = geofence.name
                        const username = 'Andrew'
                        instance.onLocationUpdated(db, io, username, socket, chatRoom)
                    } else {
                        // TODO: ADD HANDLING FOR USERS OUTSIDE TORONTO
                    }
                }
            })

            // Send received message
            socket.on(SocketEvents.outgoing_message, (message) => {
                console.log(message)
                const chatRoom = message.chatRoomName
                message['timestamp'] = new Date()

                ChatHistoryDao.create(db, message, (result) => {
                    console.log(result)
                    if (result && result.n > 0) {
                        socket.join(chatRoom)
                        io.to(chatRoom).emit(SocketEvents.incoming_message, message);
                    }
                })
            })

            // Disconnection
            socket.on(SocketEvents.disconnect, () => {
                console.log('user disconnected ' + socket.id)
                instance.setUserStatus(db, socket, null, null, false)
            })
        })
    }

    onLocationUpdated(db, io, username, socket, chatRoom) {
        socket.join(chatRoom) // Place socket in desired chatroom
        UserStatusDao.getUserStatusForChatRoom(db, username, null, null, (status) => {
            instance.setUserStatus(db, socket, username, chatRoom, true) // Set user online status to true for desired chatroom

        }, (err) => {

        })

        instance.sendChatroomUpdate(io, socket, db, chatRoom) // send chatroom update to client
    }

    // ssendUserStatusToChatRoom(socket, username, chatRoom, isOnline) {
    //     io.to(chatRoom).emit(SocketEvents.user_status_update)
    // }

    // Set user status for online/offline purposes
    setUserStatus(db, socket, username, chatRoom, isOnline) {
        UserStatusDao.setUserStatus(db, username, socket.id, chatRoom, isOnline, (result) => {
            console.log('updated user status')
        }, (err) => {
            console.error('setUserStatus Error', err)
        })
    }

    // Called when joining a new chatroom, sends room chat history to client
    sendChatroomUpdate(io, socket, db, chatRoom) {
        ChatHistoryDao.getForChatRoomUpdate(db, chatRoom, (chatHistory) => {
            io.to(socket.id).emit(SocketEvents.chatroom_update, {
                'chatRoomName': chatRoom,
                'messages': chatHistory
            })
        }, (err) => {
            console.error('sendChatroomUpdate Error', err)
        })
    }
}

module.exports = ChatSocket