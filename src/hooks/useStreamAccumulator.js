import { useState } from 'react';

/**
 * Shared hook for accumulating async generator (streaming) output.
 * Used by useReaderGeneration and useTutorChat.
 */
export function useStreamAccumulator() {
  const [streamingText, setStreamingText] = useState(null);

  async function consumeStream(stream) {
    let accumulated = '';
    setStreamingText('');
    for await (const chunk of stream) {
      accumulated += chunk;
      setStreamingText(accumulated);
    }
    setStreamingText(null);
    return accumulated;
  }

  function clearStream() {
    setStreamingText(null);
  }

  return { streamingText, consumeStream, clearStream };
}
