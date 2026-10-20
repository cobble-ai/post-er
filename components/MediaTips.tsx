export default function MediaTips({ media }: { media: string[] }) {
  if (!media.length) return null;
  return (
    <div>
      <span className="slot-label">Media ideas</span>
      <ol className="media-list">
        {media.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  );
}
