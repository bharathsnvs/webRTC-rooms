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

    this.serviceIP = "https://863a1f3ad027.ngrok.io/webrtcPeer";

    // https://reactjs.org/docs/refs-and-the-dom.html
    //this.localVideoref = React.createRef()
    //this.remoteVideoref = React.createRef()

    this.socket = null;
    //this.candidates = []
  }

  getLocalStream = () => {
    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      window.localStream = stream;
      this.setState({
        localStream: stream,
      });

      this.whoisOnline();
    };

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log("getUserMedia Error: ", e);
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    // see the above link for more constraint options
    const constraints = {
      //audio: true,
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
      },
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(success)
      .catch(failure);
  };

  whoisOnline = () => {
    //let peers know I am joining
    this.sendToPeer("onlinePeers", null, { local: this.socket.id });
  };

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload,
    });
  };

  createPeerConnection = (socketID, callback) => {
    try {
      let pc = new RTCPeerConnection(this.state.pc_config);

      //add pc to peer connections object
      const peerConnections = { ...this.state.peerConnections, [socketID]: pc };
      this.setState({
        peerConnections,
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer("candidate", e.candidate, {
            local: this.socket.id,
            remote: socketID,
          });
        }
      };

      pc.oniceconnectionstatechange = (e) => {
        //if (pc.iceConnectionState === "disconnected") {
        //  const remoteStreams = this.state.remoteStreams.filter(
        //    (stream) => stream.id !== socketID
        //  );
        //
        //  this.setState({
        //    remoteStream:
        //      (remoteStreams.length > 0 && remoteStreams[0].stream) || null,
        //  });
        //}
      };

      pc.ontrack = (e) => {
        const remoteVideo = {
          id: socketID,
          name: socketID,
          stream: e.streams[0],
        };

        this.setState((prevState) => {
          //If we already have stream in display, let it stay the same,
          //otherwise use the latest stream
          const remoteStream =
            prevState.remoteStreams.length > 0
              ? {}
              : { remoteStream: e.streams[0] };

          //Gets currently selected video
          let selectedVideo = prevState.remoteStreams.filter(
            (stream) => stream.id === prevState.selectedVideo.id
          );

          //If video is still in the list, do nothing, else set to new video stream
          selectedVideo = selectedVideo.length
            ? {}
            : { selectedVideo: remoteVideo };

          return {
            //selectedVideo: remoteVideo,
            ...selectedVideo,
            //remoteStream: e.streams[0],
            ...remoteStream,
            remoteStreams: [...prevState.remoteStreams, remoteVideo],
          };
        });
      };

      pc.close = () => {};

      if (this.state.localStream) {
        pc.addStream(this.state.localStream);
      }

      callback(pc);
    } catch (e) {
      console.log("Something went wrong, pc not created", e);
      callback(null);
    }
  };

  componentDidMount = () => {
    this.socket = io.connect(this.serviceIP, {
      path: "/io/webrtc",
      query: {
        room: window.location.pathname,
      },
    });

    this.socket.on("connection-success", (data) => {
      this.getLocalStream();

      console.log(data.success);
      const status =
        data.peerCount > 1
          ? `Peers in room ${window.location.pathname}: ${data.peerCount}`
          : "Waiting for Peers";

      this.setState({
        //connecting,
        status: status,
      });
    });

    this.socket.on("joined-peers", (data) => {
      this.setState({
        status: data.peerCount > 1
          ? `Peers in room ${window.location.pathname}: ${data.peerCount}`
          : "Waiting for Peers"
      });
    });

    this.socket.on("peer-disconnected", (data) => {
      console.log("peer-disconnected", data);
      const remoteStreams = this.state.remoteStreams.filter(
        (stream) => stream.id !== data.socketID
      );

      this.setState((prevState) => {
        //Check if disconnectde peer is the selected video and if there is still connected Peers,
        //making appropriate changes if so
        const selectedVideo =
          prevState.selectedVideo.id === data.socketID && remoteStreams.length
            ? { selectedVideo: remoteStreams[0] }
            : null;

        const status =
          data.peerCount > 1
            ? `Peers in room ${window.location.pathname}: ${data.peerCount}`
            : "Waiting for Peers";

        return {
          remoteStreams,
          ...selectedVideo,
          status: status,
        };
      });
    });

    //this.socket.on("offerOrAnswer", (sdp) => {
    //  this.textref.value = JSON.stringify(sdp);

    // set sdp as remote description
    //  this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    //});

    this.socket.on("candidate", (data) => {
      const pc = this.state.peerConnections[data.socketID];

      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }

      const status =
        data.peerCount > 1
          ? `Total Connected Peers: ${data.peerCount}`
          : "Waiting for Peers";

      this.setState({
        status: status,
      });
    });

    this.socket.on("online-peer", (socketID) => {
      console.log("Connected Peers...", socketID);
      //When a new user joins, it requests packets of data consisting of who all are
      //there in the room. So, we need to also create and send an offer to the peer
      // 1. Create new pc
      this.createPeerConnection(socketID, (pc) => {
        // 2. Create Offer
        if (pc)
          pc.createOffer(this.state.sdpConstraints).then((sdp) => {
            pc.setLocalDescription(sdp);

            this.sendToPeer("offer", sdp, {
              local: this.socket.id,
              remote: socketID,
            });
          });
      });
    });

    this.socket.on("offer", (data) => {
      this.createPeerConnection(data.socketID, (pc) => {
        pc.addStream(this.state.localStream);

        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(
          () => {
            // 2. Creating Answer
            pc.createAnswer(this.state.sdpConstraints).then((sdp) => {
              pc.setLocalDescription(sdp);
              this.sendToPeer("answer", sdp, {
                local: this.socket.id,
                remote: data.socketID,
              });
            });
          }
        );
      });
    });

    this.socket.on("answer", (data) => {
      const pc = this.state.peerConnections[data.socketID];
      console.log(data.sdp);
      pc.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      ).then(() => {});
    });
  };

  switchVideo = (_video) => {
    console.log(_video);
    this.setState({
      selectedVideo: _video,
    });
  };

  render() {
    console.log(this.state.localStream);
    console.log(this.state.peerConnections);
    const statusText = (
      <div style={{ color: "ghostwhite", padding: 5 }}>{this.state.status}</div>
    );
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
          videoStream={
            this.state.selectedVideo && this.state.selectedVideo.stream
          }
          autoPlay
        ></Video>
        <br />

        <div
          style={{
            zIndex: 3,
            position: "absolute",
            margin: 10,
            backgroundColor: "#cdc4ff4f",
            padding: 10,
            borderRadius: 5,
          }}
        >
          {statusText}
        </div>

        <div>
          <AllVideos
            switchVideo={this.switchVideo}
            remoteStreams={this.state.remoteStreams}
          ></AllVideos>
        </div>
        <br />
      </div>
    );
  }
}

export default App;
