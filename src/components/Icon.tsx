const paths: Record<string, string> = {
  clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  wheel:
    "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4L18.4 5.6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  groups:
    "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20v-2a6 6 0 0 1 12 0v2M14 14a6 6 0 0 1 8 4v2",
  draw: "M5 6h14v15H5zM8 3h11l3 3v12M9 11h6M9 15h6",
  coin: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  emoji: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8 9h.01M16 9h.01M8 14q4 5 8 0",
  symbols:
    "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  text: "M4 5h16M12 5v15M8 20h8",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 7h.01",
  qr: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6zM12 3v9H3M12 15v6M15 12h6",
};
export default function Icon({ name }: { name: string }) {
  return (
    <svg
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.text} />
    </svg>
  );
}
