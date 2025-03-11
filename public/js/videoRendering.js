class VideoRenderer {
    constructor(videoId, canvasId) {
        this.video = document.getElementById(videoId);
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isRendering = false;
        this.lastFrameTime = 0;
        this.fps = 30;
        this.frameInterval = 1000 / this.fps;
    }

    async initializeWebRTC() {
        // Need these crucial WebRTC elements:
        const configuration = {}; // Add your configuration here
        this.peerConnection = new RTCPeerConnection(configuration);
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }

    start() {
        if (!this.isRendering) {
            this.isRendering = true;
            this.render();
            console.log(`Started rendering ${this.video.id} to canvas`);
        }
    }

    stop() {
        this.isRendering = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        console.log(`Stopped rendering ${this.video.id}`);
    }

    render(timestamp = 0) {
        if (!this.isRendering) return;

        if (timestamp - this.lastFrameTime >= this.frameInterval) {
            if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
                // Set canvas size to match video
                if (this.canvas.width !== this.video.videoWidth || 
                    this.canvas.height !== this.video.videoHeight) {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                }

                // Draw video frame to canvas
                this.ctx.drawImage(this.video, 0, 0);
                this.lastFrameTime = timestamp;
            }
        }

        requestAnimationFrame(this.render.bind(this));
    }
}