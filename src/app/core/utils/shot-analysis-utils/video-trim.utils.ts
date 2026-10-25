/**
 * Longest selectable part of a video. The ball tracker analyses the first 20 s of a file (its
 * `MAX_VIDEO_SECONDS`), and a cut can run up to a key frame interval longer on each side (see
 * {@link trimVideo}), so this leaves room for that.
 */
export const MAX_SHOT_WINDOW_S = 18;

/** Closer than this to the start/end of the video counts as not trimmed. */
const EDGE_TOLERANCE_S = 0.05;

export interface TrimWindow {
  endS: number;
  startS: number;
}

export interface TrimmedVideo {
  blob: Blob;
  /** Where the cut file starts in the original video, in seconds (the key frame at or before the window start). */
  offsetS: number;
}

/** Default selection for a freshly loaded video: from the start, as long as the tracker allows. */
export function defaultTrimWindow(durationS: number): TrimWindow {
  return { startS: 0, endS: Math.min(durationS, MAX_SHOT_WINDOW_S) };
}

/**
 * Applies a knob move of the dual range: values are clamped to the video and the selection to
 * {@link MAX_SHOT_WINDOW_S}, moving the knob that was not dragged along when the window gets too long.
 */
export function clampTrimWindow(next: TrimWindow, previous: TrimWindow, durationS: number): TrimWindow {
  let startS = Math.max(0, Math.min(next.startS, durationS));
  let endS = Math.max(startS, Math.min(next.endS, durationS));
  if (endS - startS > MAX_SHOT_WINDOW_S) {
    if (startS !== previous.startS) {
      endS = startS + MAX_SHOT_WINDOW_S;
    } else {
      startS = endS - MAX_SHOT_WINDOW_S;
    }
  }
  return { startS, endS };
}

/** Whether the window leaves out a noticeable part of the video, i.e. cutting it is worth it. */
export function isTrimmed(window: TrimWindow, durationS: number): boolean {
  return window.startS > EDGE_TOLERANCE_S || window.endS < durationS - EDGE_TOLERANCE_S;
}

/**
 * Copies the part of the video covering `window` into a new MP4 without re-encoding, so the cut is
 * lossless, keeps the frame rate and takes well under a second. Encoded video can only start on a key
 * frame, so the cut begins at the key frame at or before `startS` (phones place one every 1–2 s) and
 * `offsetS` says where that is; it runs to the end of the group of pictures containing `endS`.
 * Audio is dropped, the tracker doesn't use it.
 *
 * Returns null when the video can't be cut (unsupported container or codec, no key frames); the
 * caller then sends the original file with the window instead.
 */
export async function trimVideo(file: Blob, window: TrimWindow): Promise<TrimmedVideo | null> {
  // loaded on demand: only this page needs it
  const { ALL_FORMATS, BlobSource, BufferTarget, EncodedPacketSink, EncodedVideoPacketSource, Input, Mp4OutputFormat, Output } = await import(
    'mediabunny'
  );

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    const codec = track?.codec;
    const decoderConfig = track ? await track.getDecoderConfig() : null;
    if (!track || !codec || !decoderConfig) {
      return null;
    }

    const sink = new EncodedPacketSink(track);
    const startKey = (await sink.getKeyPacket(window.startS, { verifyKeyPackets: true })) ?? (await sink.getFirstKeyPacket());
    if (!startKey) {
      return null;
    }
    const offsetS = Math.max(0, startKey.timestamp);

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const source = new EncodedVideoPacketSource(codec);
    output.addVideoTrack(source, { rotation: track.rotation });
    await output.start();

    let first = true;
    for await (const packet of sink.packets(startKey)) {
      // the next group of pictures starting after the window: everything the window needs is copied
      if (!first && packet.type === 'key' && packet.timestamp > window.endS) {
        break;
      }
      // leading frames of an open GOP reference the group before the cut and can't be decoded
      if (packet.timestamp < offsetS) {
        continue;
      }
      await source.add(packet.clone({ timestamp: packet.timestamp - offsetS }), first ? { decoderConfig } : undefined);
      first = false;
    }
    if (first) {
      await output.cancel();
      return null;
    }
    await output.finalize();

    return target.buffer ? { blob: new Blob([target.buffer], { type: 'video/mp4' }), offsetS } : null;
  } catch (error) {
    console.warn('Could not trim video, sending the original:', error);
    return null;
  } finally {
    input.dispose();
  }
}
