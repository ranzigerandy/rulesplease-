"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GameCover, type CoverGame } from "./GameCover";

/** Use the same app frame and game header as the rules chat. */
export function TeachingFrame({
  children,
  reading = false,
}: {
  children: ReactNode;
  reading?: boolean;
}) {
  return (
    <div className={`rules-app teach-app${reading ? " is-chat" : ""}`}>
      <section className="rules-main teach-app-main">{children}</section>
    </div>
  );
}

export function TeachingHeader({
  title,
  back,
  game,
  children,
}: {
  title: string;
  back: string;
  game?: CoverGame | null;
  children?: ReactNode;
}) {
  return (
    <header
      className={`chat-header teach-header${game ? "" : " teach-header-simple"}`}
    >
      <Link
        href={back}
        className="round-action"
        aria-label={
          back.includes("?game=") ? "Back to your game" : "Back to your library"
        }
      >
        <ArrowLeft />
      </Link>
      {game && <GameCover key={game.bggId} game={game} />}
      <div className="chat-title">
        <span className="teach-game-title">{title}</span>
      </div>
      <div className="teach-header-actions">{children}</div>
    </header>
  );
}
