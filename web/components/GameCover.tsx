"use client";

import Image from "next/image";
import { useState } from "react";

export type CoverGame = { name: string; bggId: number; thumbnailUrl?: string };

export function GameMonogram({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="game-monogram" aria-hidden="true">
      {letters}
    </span>
  );
}

export function GameCover({ game }: { game: CoverGame | null }) {
  const [failed, setFailed] = useState(false);
  if (!game || failed) return <GameMonogram name={game?.name ?? "?"} />;
  return (
    <span className="game-cover">
      <Image
        src={game.thumbnailUrl ?? `/api/catalog/thumbnail/${game.bggId}?v=2`}
        alt={`${game.name} cover`}
        width={80}
        height={100}
        unoptimized
        onError={() => setFailed(true)}
      />
    </span>
  );
}
