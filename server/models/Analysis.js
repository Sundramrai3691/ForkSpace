import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    language: { type: String, required: true },
    prompt: { type: String, default: "" },
    code: { type: String, required: true },
    result: {
      bugs: [{ type: String }],
      time_complexity: { type: String, default: "N/A" },
      space_complexity: { type: String, default: "N/A" },
      complexity_reasoning: { type: String, default: "" },
      style_issues: [{ type: String }],
      optimization_suggestion: {
        before: { type: String, default: "" },
        after: { type: String, default: "" },
        benefit: { type: String, default: "" },
      },
      summary: { type: String, default: "" },
      raw_text: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Analysis", analysisSchema);
