import { GATKMeans } from "../lib/algorithms/gat-kmeans/index";
import fs from "fs";

async function run() {
  const gatC = new GATKMeans();
  const resC = await gatC.execute({ 
    events: [{ id: "trigger", tags: [], venueCity: null, attendeeIds: [] }], 
    geographicDecay: true 
  });

  const gatA = new GATKMeans();
  const resA = await gatA.execute({ 
    events: [{ id: "trigger", tags: [], venueCity: null, attendeeIds: [] }], 
    geographicDecay: false 
  });

  fs.writeFileSync("gat-results.json", JSON.stringify({
    variant_C_haversine: { modularity: resC.modularity, silhouette: resC.silhouette },
    variant_A_no_geo: { modularity: resA.modularity, silhouette: resA.silhouette }
  }, null, 2));
}

run().catch(console.error);
