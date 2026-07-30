"use client";

// A "click to play" trailer.
//
// Why not just drop a YouTube <iframe> straight onto the page? Because an
// iframe is a whole second web page inside ours, and once you interact with
// YouTube's player it pushes its OWN entries into your browser history — which
// breaks the back button (you press back and stay put, or land on the wrong
// page). Loading it only after a deliberate click means pages you're just
// browsing past never create one. It's also much faster: YouTube's player is a
// big download, and most visitors never press play.
import { useState } from "react";
import Image from "next/image";
import styles from "./TrailerPlayer.module.css";

export default function TrailerPlayer({
  videoKey,
  movieTitle,
  thumbnail,
}: {
  videoKey: string;
  movieTitle: string;
  thumbnail: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        className={styles.frame}
        src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1`}
        title={`${movieTitle} trailer`}
        // Each item here is a permission we hand to the embedded player.
        // `fullscreen` matters: without it YouTube hides its fullscreen button
        // and the rest of the bottom-right controls shuffle along.
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <button
      className={styles.facade}
      onClick={() => setPlaying(true)}
      aria-label={`Play the trailer for ${movieTitle}`}
    >
      {thumbnail && (
        <Image
          src={thumbnail}
          alt=""
          fill
          sizes="(max-width: 800px) 100vw, 700px"
          // It's on screen the moment the page opens, so don't wait to fetch it.
          loading="eager"
          className={styles.thumb}
        />
      )}
      <span className={styles.playIcon} aria-hidden="true">
        ▶
      </span>
      <span className={styles.playLabel}>Play trailer</span>
    </button>
  );
}
