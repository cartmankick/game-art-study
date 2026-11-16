import { ArrowUpRight, AudioLines, Music2 } from "lucide-react";
import type { MusicShare } from "./musicShare";

export function MusicCard({ share }: { share: MusicShare }) {
  return (
    <a className="musicCard" href={share.music_url} target="_blank" rel="noopener noreferrer"
       aria-label={`用网易云音乐打开《${share.title}》${share.artist ? "，" + share.artist : ""}`}>
      <span className="musicSleeve" aria-hidden="true"><i className="musicRecord"><Music2 size={15} /></i></span>
      <span className="musicCopy"><small><AudioLines size={13} />网易云音乐</small>
        <strong>{share.title}</strong>{share.artist && <span>{share.artist}</span>}
      </span>
      <span className="musicOpen" aria-hidden="true"><ArrowUpRight size={17} /></span>
    </a>
  );
}
