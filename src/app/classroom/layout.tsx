import "@livekit/components-styles";

// LiveKit styles belong to the classroom route, not every learner page.
export default function ClassroomLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
