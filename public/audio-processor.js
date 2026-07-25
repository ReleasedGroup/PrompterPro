class PrompterAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(Math.max(1, Math.round(sampleRate / 10)));
    this.offset = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0 || channels[0].length === 0) {
      return true;
    }

    for (let inputIndex = 0; inputIndex < channels[0].length; inputIndex += 1) {
      let monoSample = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        monoSample += channels[channel][inputIndex] / channels.length;
      }
      this.chunk[this.offset] = monoSample;
      this.offset += 1;

      if (this.offset === this.chunk.length) {
        this.port.postMessage(this.chunk, [this.chunk.buffer]);
        this.chunk = new Float32Array(
          Math.max(1, Math.round(sampleRate / 10)),
        );
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("prompter-audio-processor", PrompterAudioProcessor);
