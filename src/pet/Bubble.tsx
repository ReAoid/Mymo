import { usePetStore } from "../store";

export default function Bubble() {
  const bubble = usePetStore((s) => s.bubble);
  const chatOpen = usePetStore((s) => s.chatOpen);
  if (!bubble || chatOpen) return null;
  return <div className="bubble">{bubble}</div>;
}
