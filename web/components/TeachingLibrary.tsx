"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { ArrowRight, BookOpen, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { GameCover } from "./GameCover";
import { TeachingFrame, TeachingHeader } from "./TeachingChrome";
import { useState } from "react";
import {
  api,
  teachingLibraryGames,
  type TeachingLibraryGame,
} from "@rulesplease/shared";
import { Input } from "@/components/ui/input";
import "./teaching.css";

export function TeachingLibrary() {
  return (
    <>
      <AuthLoading>
        <div className="teach-loading" role="status">
          <LoaderCircle className="spin" />
          Connecting your library…
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="teach-loading">
          <Link href="/sign-in">Sign in to open your game library</Link>
        </div>
      </Unauthenticated>
      <Authenticated>
        <TeachingLibraryContent />
      </Authenticated>
    </>
  );
}

function TeachingLibraryContent() {
  const library = useQuery(api.library.list) as
    TeachingLibraryGame[] | undefined;
  const enabled = useQuery(api.teaching.availability);
  const [query, setQuery] = useState("");
  const games = teachingLibraryGames(library ?? [], query);
  return (
    <TeachingFrame>
      <main className="teach-shell teach-library-shell">
        <TeachingHeader title="Explain this game" back="/product">
          <BookOpen size={20} aria-hidden="true" />
        </TeachingHeader>
        <div className="teach-library">
          <Image
            className="teach-mascot"
            src="/rulesplease-mascot-reading.png"
            alt=""
            width={56}
            height={56}
          />
          <h1>What would you like to learn?</h1>
          <p className="teach-lede">
            Choose a game from your library. Its approved rulebook becomes a
            complete lesson, with a memory anchor, an example turn and an
            overview to use during play.
          </p>
          <label htmlFor="teach-library-search" className="teach-search-label">
            Find a game in your library
          </label>
          <div className="teach-library-search">
            <Search size={20} aria-hidden="true" />
            <Input
              id="teach-library-search"
              type="search"
              placeholder="Search by game title…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {enabled === false && (
            <p className="teach-notice" role="status">
              Teaching is not enabled for this account yet. You can still review
              your rulebooks in your library.
            </p>
          )}
          {!library ? (
            <p className="teach-library-loading" role="status">
              <LoaderCircle className="spin" size={20} /> Loading your games…
            </p>
          ) : (
            <>
              <p className="teach-library-count" role="status">
                {games.length} {games.length === 1 ? "game" : "games"}
                {query.trim() ? " found" : " in your library"}
              </p>
              <ul className="teach-library-list">
                {games.map((row) => (
                  <li key={row._id}>
                    <Link
                      className="teach-library-game"
                      href={
                        row.status === "ready"
                          ? `/product/learn/${row._id}`
                          : `/product?game=${row._id}`
                      }
                      aria-label={`${row.status === "ready" ? "Teach me" : "Prepare rulebook for"} ${row.game!.name}`}
                    >
                      <GameCover game={row.game} />
                      <div>
                        <h2>{row.game!.name}</h2>
                        <p>
                          {row.game!.year ? `${row.game!.year} · ` : ""}
                          {row.status === "ready"
                            ? "Rulebook ready"
                            : (row.statusLabel ??
                              "Rulebook preparation needed")}
                        </p>
                        {row.rulebookSource && (
                          <p
                            className="teach-library-source"
                            title={row.rulebookSource.label}
                          >
                            {row.rulebookSource.label}
                            {row.rulebookSource.language
                              ? ` · ${row.rulebookSource.language}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {games.length === 0 && (
                <p className="teach-notice">
                  {query.trim()
                    ? "No matching games. Try another title, or add the game to your library first."
                    : "Add a game and approve its rulebook to prepare your first lesson."}
                </p>
              )}
              <Link href="/product" className="teach-library-manage">
                Manage your library or add a game <ArrowRight size={17} />
              </Link>
            </>
          )}
        </div>
      </main>
    </TeachingFrame>
  );
}
