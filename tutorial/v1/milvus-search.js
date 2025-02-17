import "dotenv/config";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { EmbeddingModel } from "bee-agent-framework/backend/embedding";

const milvusConfig = {
  address: process.env.MILVUS_ADDRESS,
  username: process.env.MILVUS_USERNAME,
  password: process.env.MILVUS_PASSWORD,
  ssl: process.env.MILVUS_SSL === 'true', // or true if required
};

(async () => {
  try {
    const client = new MilvusClient(milvusConfig);
    await client.connectPromise;
    console.log("Connected to Milvus successfully.");

    const collections = await client.showCollections();
    console.log("Collections:", collections);

    const collection_name = "hackathon_newsdata_20250215_dev";
    const collectionInfo = await client.describeCollection({collection_name: collection_name});
    console.log("Collection Information:", JSON.stringify(collectionInfo, null, 2));
    console.log("📌 Collection Schema:", JSON.stringify(collectionInfo.schema, null, 2));

    const emb = await EmbeddingModel.fromName("watsonx:intfloat/multilingual-e5-large");

    // ✅ 벡터 생성 (입력 문장 -> 벡터 변환)
    const response = await emb.create({
      values: ["What is the main topic of the article 'Philadelphia Preps for Pricey Winter Season?'"],
    });
    const searchVector = response.embeddings[0];
    const searchResponse = await client.search({
        collection_name: collection_name,  // 컬렉션 이름
        vector: searchVector,  // 검색할 벡터
        // filter: "metadata IS NOT NULL",  // metadata가 존재하는 데이터만 검색
        params: { nprobe: 64 },  // 검색 파라미터
        limit: 2,  // 가장 유사한 3개 결과 반환
        metric_type: "COSINE",  // 거리 기반 검색 (L2 norm)
        output_fields: ["id", "content", "metadata"] // "metadata.episode", "metadata.program", "metadata.title", "metadata.episode_date"],  // 반환할 필드
    });
    const filteredResults = searchResponse.results.map(result => {
        if (result.metadata) {
          delete result.metadata.dialogue;  // `metadata.dialogue` 제거
          delete result.metadata.split_content;
        }
        return result;
      });
    console.log("🔎 Search Results:", JSON.stringify(filteredResults, null, 2));



  } catch (err) {
    console.error("Error connecting to Milvus:", err);
  }
})();
