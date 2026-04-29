from __future__ import annotations

import os
from typing import List

from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rank_bm25 import BM25Okapi


class MedicalRAGEngine:
    def __init__(self, persist_dir: str = "./data/chroma_db"):
        self.embedding_function = SentenceTransformerEmbeddings(
            model_name="all-MiniLM-L6-v2"
        )
        self.persist_dir = persist_dir
        self.vector_store = None
        self.bm25 = None
        self.documents: list[str] = []

        if not os.path.exists(persist_dir):
            os.makedirs(persist_dir)

        self.vector_store = Chroma(
            persist_directory=self.persist_dir,
            embedding_function=self.embedding_function,
        )

    def ingest_text(self, text: str, source: str = "knowledge_base") -> None:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )
        docs = text_splitter.create_documents([text], metadatas=[{"source": source}])
        self.vector_store.add_documents(docs)
        self.vector_store.persist()

        self.documents.extend([doc.page_content for doc in docs])
        tokenized_corpus = [doc.split(" ") for doc in self.documents]
        self.bm25 = BM25Okapi(tokenized_corpus)

    def retrieve(self, query: str, k: int = 3) -> List[str]:
        vector_results = self.vector_store.similarity_search(query, k=k)
        vector_docs = [doc.page_content for doc in vector_results]

        keyword_docs: list[str] = []
        if self.bm25:
            keyword_docs = self.bm25.get_top_n(query.split(" "), self.documents, n=k)

        all_docs = list(set(vector_docs + keyword_docs))
        return all_docs[:k]
