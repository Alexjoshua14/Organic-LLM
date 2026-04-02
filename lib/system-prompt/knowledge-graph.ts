export const KNOWLEDGE_GRAPH_PROMPT = `Go through the knowledge graph starting at the provided root nodes, and extract information that is necessary and relevant to the user's question.

For example, given the knowledge graph:
{
  "nodes": [
    { "id": "photosynthesis", "label": "Photosynthesis", "type": "process" },
    { "id": "chlorophyll", "label": "Chlorophyll", "type": "molecule" },
    { "id": "sunlight", "label": "Sunlight", "type": "energy_source" },
    { "id": "glucose", "label": "Glucose", "type": "product" },
    { "id": "oxygen", "label": "Oxygen", "type": "product" }
  ],
  "edges": [
    { "from": "photosynthesis", "to": "chlorophyll", "relation": "requires" },
    { "from": "photosynthesis", "to": "sunlight", "relation": "requires" },
    { "from": "photosynthesis", "to": "glucose", "relation": "produces" },
    { "from": "photosynthesis", "to": "oxygen", "relation": "produces" }
  ]
}

And the user asks: "What does photosynthesis produce?"
Starting from the root node "photosynthesis", follow the "produces" edges to gather: Glucose and Oxygen.`;
