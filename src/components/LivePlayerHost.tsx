import React from 'react';
import { VideoPlayer } from './VideoPlayer';
import { useLivePlayer } from './LivePlayerContext';

// Lives above the pages so the stream keeps playing while browsing. The same <VideoPlayer>
// instance is kept when switching between full and mini so the stream doesn't reconnect.
export const LivePlayerHost = () => {
  const { live, media, stopMedia, minimize, expand, stop, zap, zapToNumber, lastChannel } = useLivePlayer();

  if (media) {
    return (
      <div className="absolute inset-0 z-40">
        <VideoPlayer
          key={media.url}
          forceTranscode
          streamUrl={media.url}
          knownDuration={media.knownDuration}
          title={media.title}
          onClose={stopMedia}
        />
      </div>
    );
  }
  if (!live) return null;

  const { channel, mode } = live;
  const wrapperClass =
    mode === 'full'
      ? 'absolute inset-0 z-40'
      : mode === 'preview'
        ? 'absolute top-4 right-4 z-40 w-[26rem] aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black'
        : 'absolute bottom-4 right-4 z-40 w-96 aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black';

  return (
    <div className={wrapperClass}>
      <VideoPlayer
        key={channel.id}
        isLive
        mode={mode}
        streamUrl={channel.streamUrl}
        alternateUrls={channel.alternateUrls}
        title={channel.name}
        channelNumber={channel.num}
        onClose={stop}
        onMinimize={minimize}
        onExpand={expand}
        onChannelUp={() => zap(1)}
        onChannelDown={() => zap(-1)}
        onLastChannel={lastChannel}
        onChannelNumber={zapToNumber}
      />
    </div>
  );
};
