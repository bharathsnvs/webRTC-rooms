import React, { Component } from "react";
import Video from "./components/Video";
import AllVideos from "./components/AllVideos";
import io from "socket.io-client";

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null,
      remoteStream: null,

      remoteStreams: [],
      peerConnections: {},
      selectedVideo: null,

      status: "Please wait...",

      pc_config: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      },

      sdpConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true,
        },
      },
    };

    this.serviceIP = "https://7af1173b5089.ngrok.io/webrtcPeer";

    // https://reactjs.org/docs/refs-and-the-dom.html
    //this.localVideoref = React.createRef()
    //this.remoteVideoref = React.createRef()

    this.socket = null;
    //this.candidates = []
  }

  componentDidMount = () => {
    this.getLocalStream();

    this.socket = io.connect(this.serviceIP, {
      path: "/io/webrtc",
      query: {},
    });

    this.socket.on("connection-success", (success) => {
      console.log(success);
    });

    this.socket.on("offerOrAnswer", (sdp) => {
      this.textref.value = JSON.stringify(sdp);

      // set sdp as remote description
      this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    this.socket.on("candidate", (data) => {
      const pc = this.state.peerConnections[data.socketID]

      if (pc)
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    this.socket.on('online-peer', socketID => {
      console.log('Connected Peers...', socketID)
      //When a new user joins, it requests packets of data consisting of who all are 
      //there in the room. So, we need to also create and send an offer to the peer
      // 1. Create new pc
      const pc = this.createPeerConnection(socketID)

      // 2. Create Offer
      if (pc)
        pc.createOffer(this.state.sdpConstraints)
          .then(sdp => {
            pc.setLocalDescription(sdp)

            this.sendToPeer('offer', sdp, {
              local: this.socket.id, 
              remote: socketID
            })
          })


    })

    this.socket.on('offer', data => {
      const pc = this.createPeerConnection(data.socketID)

      pc.addStream(this.state.localStream)

      pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
        // 2. Creating Answer
        pc.createAnswer(this.state.sdpConstraints)
          .then(sdp => {
            pc.setLocalDescription(sdp)
            this.sendToPeer('answer', sdp, {
              local: this.socket.id,
              remote: data.socketID
            })
          })
      })
    })

    this.socket.on('answer', data => {
      const pc = this.state.peerConnections[data.socketID]

      pc.setRemoteDescription(new RTCSessionDescription)
    }
  };

  getLocalStream = () => {
    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      window.localStream = stream;
      //this.localVideoref.current.srcObject = stream
      this.setState({
        localStream: stream,
      });
      //this.pc.addStream(stream);
      this.whoisOnline()
    };

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log("getUserMedia Error: ", e);
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    // see the above link for more constraint options
    const constraints = {
      // audio: true,
      video: true,
      // video: {
      //   width: 1280,
      //   height: 720
      // },
      // video: {
      //   width: { min: 1280 },
      // }
      options: {
        mirror: true,
      }
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(success)
      .catch(failure);
  };

  whoisOnline = () => {
    //let peers know I am joining
    this.sendToPeer('onlinePeers', null, this.socket.id)
  }

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload,
    });
  };

  createPeerConnection = (socketID) => {
    try {
      let pc = new RTCPeerConnection(this.state.pc_config)

      //add pc to peer connections object
      const peerConnections = { ...this.state.peerConnections, [socketID]: pc }
      this.setState({
        peerConnections
      })

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer('candidate', e.candidate, {
            local: this.socket.id,
            remote: socketID
          })
        }
      }

      pc.oniceconnectionstatechange = (e) => {
        if (pc.iceConnectionState === 'disconnected') {
          const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== socketID)

          this.setState({
            remoteStream: remoteStreams.length > 0 && remoteStreams[0].stream || null,
          })
        }
      }

      pc.ontrack = (e) => {
        const remoteVideo = {
          id: socketID,
          name: socketID, 
          stream: e.streams[0]
        }

        this.setState(prevState => {
          return {
            selectedVideo: remoteVideo,
            remoteStream: e.streams[0],
            remoteStreams: [...prevState.remoteStreams, remoteVideo]
          }
        })
      }

      pc.close = () => {

      }

      if (this.state.localStream)
        pc.addStream(this.state.localStream)

      return pc

    } catch(e) {
      console.log('Something went wrong, pc not created', e)
    }
  }

  

  setRemoteDescription = () => {
    // retrieve and parse the SDP copied from the remote peer
    const desc = JSON.parse(this.textref.value);

    // set sdp as remote description
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
  };

  addCandidate = () => {
    // retrieve and parse the Candidate copied from the remote peer
    // const candidate = JSON.parse(this.textref.value)
    // console.log('Adding candidate:', candidate)

    // add the candidate to the peer connection
    // this.pc.addIceCandidate(new RTCIceCandidate(candidate))

    this.candidates.forEach((candidate) => {
      console.log(JSON.stringify(candidate));
      this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  };

  render() {
    console.log(this.state.localStream);
    return (
      <div>
        <Video
          videoStyle={{
            zIndex: 2,
            position: "fixed",
            right: 0,
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: "black",
          }}
          //ref={ this.localVideoref }
          videoStream={this.state.localStream}
          autoPlay
          muted
        ></Video>

        <Video
          videoStyle={{
            zIndex: 1,
            position: "fixed",
            bottom: 0,
            minWidth: "100%",
            minHeight: "100%",
            backgroundColor: "black",
          }}
          //ref={ this.remoteVideoref }
          videoStream={this.state.remoteStream}
          autoPlay
        ></Video>

        <div>
          <AllVideos
            switchVideo={() => {}}
            remoteStreams={this.state.remoteStreams}
          ></AllVideos>
        </div>
        <br />

        <div style={{ zIndex: 1, position: "fixed" }}>
          <button onClick={this.createOffer}>Offer</button>
          <button onClick={this.createAnswer}>Answer</button>
          <br />
          <textarea
            style={{ width: 450, height: 40 }}
            ref={(ref) => {
              this.textref = ref;
            }}
          />
        </div>

        {/* <br />
        <button onClick={this.setRemoteDescription}>Set Remote Desc</button>
        <button onClick={this.addCandidate}>Add Candidate</button> */}
      </div>
    );
  }
}

export default App;
