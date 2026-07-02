type Props = {
  summary: string;
  comments: string[];
};

export default function AIAnalysis({
  summary,
  comments,
}: Props) {
  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-5">

      <h2 className="text-xl font-bold mb-4">
        🤖 AI分析
      </h2>

      <p className="mb-5 leading-8 text-gray-700">
  {summary}
</p>

      <div className="grid gap-3">
        {comments.map((comment) => (
          <div
  key={comment}
  className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-indigo-100"
>

  <span className="text-indigo-600 font-bold">
    ✓
  </span>

  <p>{comment}</p>

</div>
        ))}
      </div>

    </div>
  );
}