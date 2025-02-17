import "dotenv/config";
import { EmbeddingModel } from "bee-agent-framework/backend/embedding";

const model = await EmbeddingModel.fromName("watsonx:intfloat/multilingual-e5-large");
console.log(model.providerId); // watsonx
console.log(model.modelId); // ibm/granite-embedding-107m-multilingual

const response = await model.create({
    values: ["Hello world!", "Hello Bee!"],
});
console.log(response.values);
console.log(response.embeddings);