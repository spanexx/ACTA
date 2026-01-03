import { InferenceClient } from "@huggingface/inference";

const hf = new InferenceClient(process.env.HF_TOKEN);

async function getResponse(text) {
  const result = await hf.chatCompletion({
    model: "meta-llama/Llama-3.1-70B-Instruct",
    messages: [{ role: "user", content: text }],
  });
  console.log(result.choices[0].message.content);
}

getResponse("What was the last thing i asked you?");
