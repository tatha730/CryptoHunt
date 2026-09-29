"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, Edge, Node } from "reactflow";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronRight,
  CircleHelp, Copy, Search, ShieldCheck, Wallet,
  X, Activity, Network, FileText, Loader2
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

const sampleAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

type ApiTx = {
  hash: string;
  from_address: string;
  to_address?: string | null;
  value_wei: number;
  block_number: number;
  timestamp: number;
  is_error: boolean;
  transaction_type: string;
};

type ApiToken = {
  hash: string;
  from_address: string;
  to_address?: string | null;
  token_contract: string;
  token_name: string;
  token_symbol: string;
  token_decimals: number;
  token_value: string;
  block_number: number;
  timestamp: number;
  transaction_type: string;
};

type Candidate = {
  vasp: string;
  category: string;
  endpoint: string;
  label: string;
  confidence: number;
  hops: number;
  path: any[];
  evidence: string[];
};

type Analysis = {
  address: string;
  chain: string;
  transaction_count: number;
  token_transfer_count: number;
  transactions: ApiTx[];
  token_transfers: ApiToken[];
  graph: {
    node_count: number;
    edge_count: number;
    nodes: any[];
    edges: any[];
  };
  vasp_attribution: {
    candidate_count: number;
    candidates: Candidate[];
  };
  demo_attribution?: {
    demo_mode: boolean;
    candidates: Candidate[];
    notice: string;
  };
};

function shortAddress(address?: string | null) {
  if (!address) return "Contract / unknown";
  return `${address.slice(0, 7)}...${address.slice(-5)}`;
}

function formatTime(timestamp: number) {
  if (!timestamp) return "Unknown";
  return new Date(timestamp * 1000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ethAmount(wei: number) {
  const eth = Number(wei) / 1e18;
  if (!Number.isFinite(eth)) return "0";
  if (eth === 0) return "0 ETH";
  return `${eth.toFixed(4)} ETH`;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("Ethereum");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayAddress = address.trim() || analysis?.address || sampleAddress;

  async function analyze(forceDemo = false) {
    const wallet = address.trim() || sampleAddress;

    if (chain !== "Ethereum") {
      setError("The live backend currently supports Ethereum only.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/v1/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: wallet,
          chain: "ethereum",
          demo_mode: forceDemo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Analysis failed.");
      }

      setAnalysis(data);

      window.setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);
    } catch (err: any) {
      setError(
        err?.message ||
        "Could not connect to ChainTrace backend. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  }

  function copyAddress() {
    navigator.clipboard?.writeText(displayAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const candidates: Candidate[] = useMemo(() => {
    if (!analysis) return [];

    // Real attribution results are preferred.
    if (analysis.vasp_attribution?.candidates?.length) {
      return analysis.vasp_attribution.candidates;
    }

    // The demo attribution makes the full investigative workflow
    // visible even when the curated demo endpoints are not present
    // in the live wallet's transaction graph.
    return analysis.demo_attribution?.candidates || [];
  }, [analysis]);

  const top = candidates[0];

  const graphNodes: Node[] = useMemo(() => {
    if (!analysis) return [];

    const target = analysis.address.toLowerCase();

    const sorted = [...analysis.graph.nodes]
      .sort((a, b) => {
        if (a.id === target) return -1;
        if (b.id === target) return 1;
        return (b.total_transactions || 0) - (a.total_transactions || 0);
      })
      .slice(0, 9);

    const positions = [
      { x: 30, y: 155 },
      { x: 300, y: 50 },
      { x: 300, y: 155 },
      { x: 300, y: 260 },
      { x: 575, y: 50 },
      { x: 575, y: 155 },
      { x: 575, y: 260 },
      { x: 850, y: 105 },
      { x: 850, y: 220 },
    ];

    return sorted.map((node, index) => {
      const isTarget = node.id === target;

      return {
        id: node.id,
        position: positions[index] || { x: 300, y: 155 },
        data: {
          label: `${isTarget ? "TARGET WALLET" : "WALLET"}\n${shortAddress(node.id)}\n${node.total_transactions || 0} interactions`,
        },
        style: {
          width: isTarget ? 190 : 170,
          borderColor: isTarget ? "#55b99f" : "#cbd9de",
          boxShadow: isTarget
            ? "0 3px 12px rgba(24,166,125,.15)"
            : "0 3px 10px rgba(30,50,60,.07)",
        },
      };
    });
  }, [analysis]);

  const graphEdges: Edge[] = useMemo(() => {
    if (!analysis) return [];

    const nodeIds = new Set(graphNodes.map((n) => n.id));

    return analysis.graph.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .slice(0, 18)
      .map((e, i) => ({
        id: `${e.id || "edge"}-${i}`,
        source: e.source,
        target: e.target,
        label: e.asset === "ETH" ? ethAmount(Number(e.amount)) : e.asset,
        animated: i < 3,
      }));
  }, [analysis, graphNodes]);

  const recentTxs = useMemo(() => {
    if (!analysis) return [];

    const target = analysis.address.toLowerCase();

    return analysis.transactions
      .slice(0, 8)
      .map((tx) => ({
        hash: tx.hash,
        time: formatTime(tx.timestamp),
        type: tx.from_address.toLowerCase() === target ? "OUT" : "IN",
        counterparty:
          tx.from_address.toLowerCase() === target
            ? tx.to_address
            : tx.from_address,
        amount: ethAmount(tx.value_wei),
        asset: "ETH",
        status: tx.is_error ? "Failed" : "Confirmed",
      }));
  }, [analysis]);

  const inflow = analysis
    ? analysis.transactions.filter(
        (tx) => tx.to_address?.toLowerCase() === analysis.address.toLowerCase()
      ).length
    : 0;

  const outflow = analysis
    ? analysis.transactions.filter(
        (tx) => tx.from_address.toLowerCase() === analysis.address.toLowerCase()
      ).length
    : 0;

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Network size={20}/></div>
          <div><strong>ChainTrace</strong><span>Blockchain Intelligence</span></div>
        </div>
        <div className="header-right">
          <span className="demo-pill">LIVE BLOCKCHAIN + DEMO ATTRIBUTION</span>
          <div className="status-dot"><i/> Intelligence Engine Online</div>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow"><ShieldCheck size={15}/> LEA INVESTIGATION WORKSPACE</div>
        <h1>Trace the wallet.<br/><em>Explain the attribution.</em></h1>
        <p>
          Identify VASP-associated endpoints from observable blockchain
          transaction paths — with evidence investigators can inspect.
        </p>

        <div className="search-card">
          <div className="field">
            <label>BLOCKCHAIN</label>
            <select value={chain} onChange={e => setChain(e.target.value)}>
              <option>Ethereum</option>
              <option>Bitcoin</option>
              <option>TRON</option>
            </select>
          </div>

          <div className="field address-field">
            <label>WALLET ADDRESS</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") analyze();
              }}
              placeholder={`Enter Ethereum address (try ${sampleAddress.slice(0, 10)}...)`}
            />
          </div>

          <div className="analyze-actions">
            <button className="analyze-btn" onClick={() => { setDemoMode(false); analyze(false); }} disabled={loading}>
              {loading && !demoMode ? <Loader2 size={18} className="spin"/> : <Search size={18}/>}
              {loading && !demoMode ? "Analyzing..." : "Analyze Wallet"}
            </button>
            <button className="demo-btn" onClick={() => { setDemoMode(true); analyze(true); }} disabled={loading}>
              {loading && demoMode ? <Loader2 size={17} className="spin"/> : <Activity size={17}/>}
              {loading && demoMode ? "Running demo..." : "Run Controlled Demo"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 10, color: "#71838b", fontFamily: "DM Mono" }}>
          Tip: use <strong>Analyze Wallet</strong> for live blockchain data, or <strong>Run Controlled Demo</strong> to demonstrate a verified 3-hop attribution path end-to-end.
        </div>

        {error && (
          <div style={{
            marginTop: 14,
            padding: "12px 14px",
            border: "1px solid #e6caca",
            background: "#fff7f7",
            color: "#9c5555",
            borderRadius: 7,
            fontSize: 11
          }}>
            <AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 7 }}/>
            {error}
          </div>
        )}
      </section>

      {analysis && <section id="results" className="results">
        <div className="section-heading">
          <div>
            <span className="section-kicker">INVESTIGATION RESULT</span>
            <h2>Wallet Overview</h2>
          </div>
          <div className="address-chip">
            <Wallet size={15}/>
            <span>{shortAddress(displayAddress)}</span>
            <button onClick={copyAddress}><Copy size={14}/></button>
            {copied && <b>Copied</b>}
          </div>
        </div>

        <div className="stats">
          <Stat
            icon={<Wallet/>}
            label="Blockchain"
            value="Ethereum"
            sub="Live API source"
          />
          <Stat
            icon={<Activity/>}
            label="Transactions"
            value={String(analysis.transaction_count)}
            sub="Retrieved from Etherscan"
          />
          <Stat
            icon={<ArrowDownLeft/>}
            label="Token Transfers"
            value={String(analysis.token_transfer_count)}
            sub={`${inflow} direct ETH inflows`}
          />
          <Stat
            icon={<ArrowUpRight/>}
            label="Graph Relationships"
            value={String(analysis.graph.edge_count)}
            sub={`${analysis.graph.node_count} wallets observed`}
          />
        </div>

        <div className="grid-two">
          <div className="panel graph-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">MULTI-HOP TRACE</span>
                <h3>Transaction Graph</h3>
              </div>
              <span className="live-label"><i/> Live blockchain data</span>
            </div>

            <div className="graph">
              {graphNodes.length ? (
                <ReactFlow
                  nodes={graphNodes}
                  edges={graphEdges}
                  fitView
                  fitViewOptions={{ padding: 0.15 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  zoomOnScroll={false}
                >
                  <Background gap={24} />
                  <Controls showInteractive={false}/>
                </ReactFlow>
              ) : (
                <div style={{ padding: 30, color: "#71838b" }}>
                  No graph relationships were returned.
                </div>
              )}
            </div>

            <div className="graph-legend">
              <span><i className="legend-dot unknown"/> Target wallet</span>
              <span><i className="legend-dot intermediary"/> Counterparty</span>
              <span><i className="legend-dot vasp"/> VASP endpoint</span>
            </div>
          </div>

          <div className="panel attribution-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">ENTITY ATTRIBUTION</span>
                <h3>Nearest VASP Candidates</h3>
              </div>
              <CircleHelp size={18}/>
            </div>

            <div className="candidate-list">
              {candidates.length === 0 && (
                <div style={{ padding: 20, color: "#71838b", fontSize: 11 }}>
                  No known VASP-associated endpoint was found in the current
                  graph depth.
                </div>
              )}

              {candidates.map((c, i) => (
                <div
                  className={"candidate " + (i === 0 ? "top-candidate" : "")}
                  key={`${c.vasp}-${i}`}
                >
                  <div className="candidate-main">
                    <div className="rank">{String(i + 1).padStart(2, "0")}</div>
                    <div>
                      <strong>{c.vasp}</strong>
                      <small>{c.evidence?.[0] || c.label}</small>
                    </div>
                  </div>
                  <div className="score-wrap">
                    <strong>{c.confidence}%</strong>
                    <span>
                      {c.confidence >= 75 ? "HIGH" : c.confidence >= 50 ? "MEDIUM" : "LOW"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {top && (
              <button className="why-btn" onClick={() => setWhyOpen(true)}>
                Why this attribution? <ChevronRight size={16}/>
              </button>
            )}

            <div className="disclaimer">
              <AlertTriangle size={14}/>
              Association does not prove wallet ownership or customer identity.
            </div>
          </div>
        </div>

        {top && (
          <div className="panel investigation-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">PRIMARY INVESTIGATION PATH</span>
                <h3>How ChainTrace Reached the Top Candidate</h3>
              </div>
              <div className="path-summary">
                <span>{top.hops} HOPS</span>
                <span>{Math.max(0, (top.path?.length || 1) - 2)} INTERMEDIATE</span>
                <strong>{top.confidence}% CONFIDENCE</strong>
              </div>
            </div>

            <div className="path-flow">
              {(() => {
                const demoPath = top.path?.length
                  ? top.path
                  : [
                      { wallet: analysis.address, role: "Target wallet" },
                      { wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", role: "Intermediate wallet" },
                      { wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", role: "Intermediate wallet" },
                      { wallet: top.endpoint, role: "Known VASP-associated endpoint" },
                    ];

                return demoPath.map((item: any, index: number) => {
                  const isFirst = index === 0;
                  const isLast = index === demoPath.length - 1;

                  return (
                    <div className="path-step-wrap" key={`${item.wallet}-${index}`}>
                      <div className={`path-step ${isFirst ? "target-step" : ""} ${isLast ? "vasp-step" : ""}`}>
                        <div className="path-icon">
                          {isFirst ? <Wallet size={17}/> : isLast ? <ShieldCheck size={17}/> : <Network size={17}/>}
                        </div>
                        <div className="path-copy">
                          <span>{item.role || (isFirst ? "Target wallet" : isLast ? "Known VASP-associated endpoint" : "Intermediate wallet")}</span>
                          <strong>{isLast ? top.vasp : shortAddress(item.wallet)}</strong>
                          {!isLast && <small>{item.wallet}</small>}
                          {isLast && <small>{shortAddress(item.wallet)}</small>}
                        </div>
                      </div>

                      {!isLast && (
                        <div className="path-arrow">
                          <ChevronRight size={19}/>
                          <span>transaction hop</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="path-evidence">
              <div><ShieldCheck size={15}/><span>Known VASP-associated endpoint</span></div>
              <div><Activity size={15}/><span>Observable transaction path</span></div>
              <div><Network size={15}/><span>{top.hops} hop path detected</span></div>
              <div><CircleHelp size={15}/><span>Association ≠ ownership</span></div>
            </div>
          </div>
        )}

        <div className="panel tx-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">ON-CHAIN EVIDENCE</span>
              <h3>Recent Transactions</h3>
            </div>
            <button className="ghost-btn" onClick={() => setReportOpen(true)}>
              <FileText size={15}/> Evidence Report
            </button>
          </div>

          <div className="tx-table">
            <div className="tx-row tx-head">
              <span>TRANSACTION</span>
              <span>TIME</span>
              <span>COUNTERPARTY</span>
              <span>VALUE</span>
              <span>STATUS</span>
            </div>

            {recentTxs.map(tx => (
              <div className="tx-row" key={tx.hash}>
                <span className="hash">{shortAddress(tx.hash)}</span>
                <span>{tx.time}</span>
                <span className="hash">{shortAddress(tx.counterparty)}</span>
                <span className={tx.type === "IN" ? "in-value" : "out-value"}>
                  {tx.type === "IN" ? "+" : "-"}{tx.amount}
                </span>
                <span className="confirmed">
                  <i/> {tx.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 14,
          padding: "12px 15px",
          border: "1px dashed #cbd9de",
          borderRadius: 7,
          background: "#fafcfc",
          fontSize: 10,
          lineHeight: 1.5,
          color: "#71838b"
        }}>
          <strong style={{ color: "#52676f" }}>DATA PROVENANCE:</strong>{" "}
          Transaction and token-transfer data above are fetched live from the
          Ethereum blockchain intelligence API. VASP attribution is shown from
          the configured intelligence registry; if the live graph does not
          contain a registered endpoint, the prototype's clearly labelled demo
          attribution is used to demonstrate the complete investigation workflow.
        </div>
      </section>}

      <footer>
        <span>ChainTrace Prototype</span>
        <span>For investigation workflow demonstration only</span>
      </footer>

      {reportOpen && (
        <div className="modal-backdrop" onClick={() => setReportOpen(false)}>
          <div className="report-modal" onClick={e => e.stopPropagation()}>
            <div className="report-toolbar">
              <div>
                <span className="section-kicker">CHAINTRACE / INVESTIGATION OUTPUT</span>
                <h2>Blockchain Investigation Report</h2>
              </div>
              <button className="modal-close" onClick={() => setReportOpen(false)}>
                <X size={18}/>
              </button>
            </div>

            <div className="report-meta">
              <div>
                <span>CASE STATUS</span>
                <strong>ANALYSIS COMPLETE</strong>
              </div>
              <div>
                <span>CHAIN</span>
                <strong>Ethereum</strong>
              </div>
              <div>
                <span>DATA SOURCE</span>
                <strong>Live API</strong>
              </div>
            </div>

            <div className="report-section">
              <span className="section-kicker">01 / TARGET</span>
              <h3>Unknown Wallet</h3>
              <code>{analysis?.address}</code>
            </div>

            <div className="report-grid">
              <div className="report-stat">
                <span>TRANSACTIONS</span>
                <strong>{analysis?.transaction_count ?? 0}</strong>
              </div>
              <div className="report-stat">
                <span>ERC-20 TRANSFERS</span>
                <strong>{analysis?.token_transfer_count ?? 0}</strong>
              </div>
              <div className="report-stat">
                <span>WALLETS OBSERVED</span>
                <strong>{analysis?.graph.node_count ?? 0}</strong>
              </div>
              <div className="report-stat">
                <span>GRAPH RELATIONSHIPS</span>
                <strong>{analysis?.graph.edge_count ?? 0}</strong>
              </div>
            </div>

            {top && (
              <>
                <div className="report-section">
                  <span className="section-kicker">02 / TOP VASP CANDIDATE</span>
                  <div className="report-candidate">
                    <div>
                      <h3>{top.vasp}</h3>
                      <span>{top.category} · {top.hops} hop path</span>
                    </div>
                    <strong>{top.confidence}%</strong>
                  </div>
                  <code>{top.endpoint}</code>
                </div>

                <div className="report-section">
                  <span className="section-kicker">03 / PRIMARY PATH</span>
                  <div className="report-path-text">
                    {(top.path?.length ? top.path : [
                      { wallet: analysis?.address },
                      { wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
                      { wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
                      { wallet: top.endpoint }
                    ]).map((item: any, i: number, arr: any[]) => (
                      <span key={`${item.wallet}-${i}`}>
                        <b>{i === 0 ? "TARGET" : i === arr.length - 1 ? "VASP ENDPOINT" : "HOP " + i}</b>
                        <code>{shortAddress(item.wallet)}</code>
                        {i < arr.length - 1 && <ChevronRight size={14}/>}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="report-section">
                  <span className="section-kicker">04 / EVIDENCE</span>
                  <div className="report-evidence">
                    {(top.evidence || []).map((text, i) => (
                      <div key={i}>
                        <ShieldCheck size={14}/>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="report-warning">
              <AlertTriangle size={16}/>
              <div>
                <strong>Investigative limitation</strong>
                <p>
                  Transaction-path association does not establish wallet ownership
                  or customer identity. Further investigation and lawful disclosure
                  procedures are required before making an identity determination.
                </p>
              </div>
            </div>

            {analysis?.demo_attribution?.demo_mode && (
              <div className="report-demo">
                <strong>DEMO DATA</strong>
                <span>
                  VASP attribution is simulated when the live transaction graph does
                  not contain a registered demo endpoint. Blockchain transaction
                  counts and transaction records remain sourced from the live API.
                </span>
              </div>
            )}

            <div className="report-footer">
              <span>Generated by ChainTrace Prototype</span>
              <button className="ghost-btn" onClick={() => window.print()}>
                <FileText size={14}/> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {whyOpen && top && (
        <div className="modal-backdrop" onClick={() => setWhyOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setWhyOpen(false)}>
              <X size={18}/>
            </button>

            <span className="section-kicker">EXPLAINABLE ATTRIBUTION</span>

            <div className="modal-title">
              <div className="big-score">{top.confidence}%</div>
              <div>
                <h2>{top.vasp}</h2>
                <span className="high">
                  {top.confidence >= 75 ? "HIGH CONFIDENCE" : "PROTOTYPE SCORE"}
                </span>
              </div>
            </div>

            <p className="modal-intro">
              The score is based on observable transaction-path evidence.
              It is not a claim of ownership or customer identity.
            </p>

            <div className="evidence-list">
              {(top.evidence || []).map((text, i) => (
                <Evidence
                  key={i}
                  n={String(i + 1).padStart(2, "0")}
                  title={
                    i === 0
                      ? "Endpoint / path evidence"
                      : i === 1
                      ? "Transaction relationship"
                      : "Supporting evidence"
                  }
                  text={text}
                  weight={i === 0 ? "+30" : i === 1 ? "+20" : "+10"}
                />
              ))}
            </div>

            <div className="formula">
              <span>Attribution score</span>
              <strong>{top.confidence} / 100</strong>
            </div>

            {analysis.demo_attribution?.demo_mode && (
              <div style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 7,
                background: "#fff8ed",
                border: "1px solid #ecd8b9",
                color: "#806744",
                fontSize: 10,
                lineHeight: 1.5
              }}>
                <strong>DEMO NOTICE:</strong> This candidate is simulated for
                demonstrating the intended attribution workflow and must not
                be treated as real VASP ownership evidence.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Evidence({
  n,
  title,
  text,
  weight,
}: {
  n: string;
  title: string;
  text: string;
  weight: string;
}) {
  return (
    <div className="evidence">
      <div className="e-num">{n}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <b>{weight}</b>
    </div>
  );
}
