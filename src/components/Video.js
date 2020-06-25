import React, { Component } from "react";

class Video extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentWillReceiveProps(nextProps){
    this.video.srcObject = nextProps.videoStream
  }

  render() {
    return (
      <div>
        <video 
        id={this.props.id} 
        muted={this.props.muted} 
        autoPlay 
        style={this.props.videoStyle}
        //ref={this.props.videoRef}
        ref={ (ref) => {this.video = ref }}
        ></video>
      </div>
    );
  }
}

export default Video;
