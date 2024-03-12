import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";
import { delay } from "../utils";
type NodeState = {
  killed: boolean;
  x: 0 | 1 | "?" | null;
  decided: boolean | null;
  k: number | null;
};
export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());
  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  // TODO implement this
  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });
  let currentState: NodeState = {
    killed: false,
    x: initialValue,
    decided: false,
    k: 0,
  };
  // TODO implement this
  // this route is used to start the consensus algorithm
  // node.get("/start", async (req, res) => {});

  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) { await delay(100);}
    if (!isFaulty) {
      currentState.k = 1;
      currentState.x = initialValue;
      currentState.decided = false;
      for (let i = 0; i < N; i++) {
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            k: currentState.k,
            x: currentState.x,
            type: "2P",
          }),
        });
      }
    } else {
      currentState.decided = null;
      currentState.x = null;
      currentState.k = null;
    }
    res.status(200).send("success");
  });
  // TODO implement this
  // this route allows the node to receive messages from other nodes
  // node.post("/message", (req, res) => {});
  node.post("/message", async (req, res) => {
    let { k, x, type }: { k: number; x: Value; type: string; } = req.body;
    if (!isFaulty && !currentState.killed) {
      if (type == "2P") {
        if (!proposals.has(k)) {proposals.set(k, []);}
        proposals.get(k)!.push(x);
        let proposal = proposals.get(k)!;

        if (proposal.length >= N - F) {
          let count0 = proposal.filter((el) => el == 0).length;
          let count1 = proposal.filter((el) => el == 1).length;
          if (count0 > N / 2) {
            x = 0;
          } else if (count1 > N / 2) {
            x = 1;
          } else {
            x = "?";
          }
          for (let i = 0; i < N; i++) {
            fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ k: k, x: x, type: "2V" }),
            });
          }
        }
      } else if (type == "2V") {
        if (!votes.has(k)) {votes.set(k, []);}
        votes.get(k)!.push(x);
        let vote = votes.get(k)!;
        if (vote.length >= N - F) {
          let count0 = vote.filter((el) => el == 0).length;
          let count1 = vote.filter((el) => el == 1).length;
          if (count0 >= F + 1) {
            currentState.x = 0;
            currentState.decided = true;
          } else if (count1 >= F + 1) {
            currentState.x = 1;
            currentState.decided = true;
          } else {
            if (count0 + count1 > 0 && count0 > count1) {
              currentState.x = 0;
            } else if (count0 + count1 > 0 && count0 < count1) {
              currentState.x = 1;
            } else {
              currentState.x = Math.random() > 0.5 ? 0 : 1;
            }
            currentState.k = k + 1;

            for (let i = 0; i < N; i++) {
              fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  k: currentState.k,
                  x: currentState.x,
                  type: "2P",
                }),
              });
            }
          }
        }
      }
    }
    res.status(200).send("success");
  });
  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    currentState.killed = true;
    currentState.x = null;
    currentState.decided = null;
    currentState.k = 0;
    res.send("Node stopped");
  });

  // TODO implement this
  node.get("/getState", (req, res) => {
    if (isFaulty) {
      res.send({
        killed: currentState.killed,
        x: null,
        decided: null,
        k: null,
      });
    } else {
      res.send(currentState);
    }
  });

  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );
    setNodeIsReady(nodeId);
  });

  return server;
}
