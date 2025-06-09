"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

interface Player {
  inventory: number;
  backorder: number;
  incomingShipments: number[]; // 上流からの出荷が到着するパイプライン
  incomingOrders: number[]; // 下流からの注文が到着するパイプライン
  weeklyCosts: number[];
  weeklyInventory: number[];
  weeklyBackorder: number[];
  weeklyOrders: number[];
}

interface GameConfig {
  weeks: number;
  retailerOrderMin: number;
  retailerOrderMax: number;
  playerActions: string[];
}

interface SimulationResult {
  // 各プレイヤー（小売店、卸売業者、販売代理店、製造業者）の状態と履歴を含む配列
  players: Player[];

  // 各プレイヤーの総コスト（在庫コスト + 欠品コスト）の配列
  totalCosts: number[];

  // 全プレイヤーのコストの合計値
  overallTotalCost: number;

  // グラフ描画用の週次データ配列
  chartData: {
    // 週番号（1から開始）
    week: number;
    // 各プレイヤーの在庫レベル
    retailer: number; // 小売店の在庫
    wholesaler: number; // 卸売業者の在庫
    distributor: number; // 販売代理店の在庫
    manufacturer: number; // 製造業者の在庫

    // 各プレイヤーの欠品数
    retailerBackorder: number; // 小売店の欠品数
    wholesalerBackorder: number; // 卸売業者の欠品数
    distributorBackorder: number; // 販売代理店の欠品数
    manufacturerBackorder: number; // 製造業者の欠品数

    // 各プレイヤーの週間コスト
    retailerCost: number; // 小売店の週間コスト
    wholesalerCost: number; // 卸売業者の週間コスト
    distributorCost: number; // 販売代理店の週間コスト
    manufacturerCost: number; // 製造業者の週間コスト
  }[];
}

const BeerGameSimulator = () => {
  const [actionsView, setActionsView] = useState<string>("");
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    weeks: 20,
    retailerOrderMin: 0,
    retailerOrderMax: 20,
    playerActions: [],
  });

  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null);
  const [retailerDemands, setRetailerDemands] = useState<number[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true after component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate random demands on client side
  useEffect(() => {
    if (!isClient) return;

    const demands = Array.from(
      { length: gameConfig.weeks },
      () =>
        Math.floor(
          Math.random() *
            (gameConfig.retailerOrderMax - gameConfig.retailerOrderMin + 1)
        ) + gameConfig.retailerOrderMin
    );
    setRetailerDemands(demands);
  }, [
    gameConfig.weeks,
    gameConfig.retailerOrderMin,
    gameConfig.retailerOrderMax,
    isClient,
  ]);

  // プレイヤーの初期状態を作成
  const initializePlayer = (): Player => ({
    inventory: 12,
    backorder: 0,
    incomingShipments: [4, 4], // 初期状態として2週間分の出荷予約
    incomingOrders: [4, 4], // 初期状態として2週間分の注文予約
    weeklyCosts: [],
    weeklyInventory: [],
    weeklyBackorder: [],
    weeklyOrders: [],
  });

  // 1週間の処理を実行する関数
  const processWeek = (
    players: Player[],
    week: number,
    retailerDemand: number,
    playerOrders: number[][]
  ): Player[] => {
    // ディープコピーして状態を更新
    const newPlayers = JSON.parse(JSON.stringify(players)) as Player[];

    // 1. 上流からの出荷を受け取り (2週間前に注文した分が届く)
    newPlayers.forEach((player) => {
      if (player.incomingShipments.length > 0) {
        const incoming = player.incomingShipments.shift() || 0;
        player.inventory += incoming;
      }
    });

    // 2. 下流からの需要 (注文) を処理し、出荷を決定
    newPlayers.forEach((player, index) => {
      let demand = 0;
      if (index === 0) {
        // 小売店: 外部需要
        demand = retailerDemand;
      } else {
        // 卸売業者, 販売代理店, 製造業者: 下流から2週間前に送られてきた注文
        if (player.incomingOrders.length > 0) {
          demand = player.incomingOrders.shift() || 0;
        }
      }

      // 出荷可能量を計算（在庫 + バックオーダー処理）
      const totalDemand = demand + player.backorder;
      const shipment = Math.min(totalDemand, player.inventory);

      // 在庫から出荷
      player.inventory -= shipment;

      // バックオーダーの更新
      player.backorder = Math.max(0, totalDemand - shipment);

      // 下流への出荷をスケジューリング (2週間後に到着)
      if (index > 0) {
        const downstream = newPlayers[index - 1];
        // 配送パイプラインに追加（2週間後に到着）
        downstream.incomingShipments.push(shipment);
      }
    });

    // 3. 上流への新たな注文をスケジューリング (2週間後に到着)
    newPlayers.forEach((player, index) => {
      // 各プレイヤーが今週アップストリームに出す注文量
      const order = playerOrders[week - 1]?.[index] || 4;
      player.weeklyOrders.push(order);

      if (index < 3) {
        // 小売店->卸売業者, 卸売業者->販売代理店, 販売代理店->製造業者
        const upstream = newPlayers[index + 1];
        upstream.incomingOrders.push(order);
      } else {
        // 製造業者の場合：注文した分を2週間後に生産完了として受け取る
        // 製造業者は無限の生産能力を持つと仮定
        player.incomingShipments.push(order);
      }
    });

    // 4. コスト計算 (在庫コスト + 欠品コスト)
    newPlayers.forEach((player) => {
      const inventoryCost = player.inventory * 0.5;
      const backorderCost = player.backorder * 1.0;
      const totalCost = inventoryCost + backorderCost;

      player.weeklyCosts.push(totalCost);
      player.weeklyInventory.push(player.inventory);
      player.weeklyBackorder.push(player.backorder);
    });

    return newPlayers;
  };

  // シミュレーション実行関数
  const runSimulation = () => {
    // プレイヤー初期化
    const players = [
      initializePlayer(), // 小売店 (Retailer)
      initializePlayer(), // 卸売業者 (Wholesaler)
      initializePlayer(), // 販売代理店 (Distributor)
      initializePlayer(), // 製造業者 (Manufacturer)
    ];

    // 入力されたプレイヤー行動 (毎週の注文量) を解析
    const playerOrders: number[][] = [];
    gameConfig.playerActions.forEach((weekAction) => {
      const orders = weekAction
        .split(",")
        .map((order: string) => parseInt(order.trim()) || 4);
      while (orders.length < 4) orders.push(4); // 不足分はデフォルト注文数で埋める
      playerOrders.push(orders);
    });
    // 指定がない週はすべて4で埋める
    while (playerOrders.length < gameConfig.weeks) {
      playerOrders.push([4, 4, 4, 4]);
    }

    let currentPlayers = players;

    // 各週のシミュレーションを実行
    for (let week = 1; week <= gameConfig.weeks; week++) {
      // 小売店への外部需要 (事前に生成した乱数を使用)
      const retailerDemand = retailerDemands[week - 1] || 4;

      currentPlayers = processWeek(
        currentPlayers,
        week,
        retailerDemand,
        playerOrders
      );
    }

    // 各プレイヤーの総コスト計算
    const totalCosts = currentPlayers.map((player) =>
      player.weeklyCosts.reduce((sum, cost) => sum + cost, 0)
    );

    // グラフ描画用データ作成
    const chartData = [];
    for (let week = 0; week < gameConfig.weeks; week++) {
      chartData.push({
        week: week + 1,
        retailer: currentPlayers[0].weeklyInventory[week] || 0,
        wholesaler: currentPlayers[1].weeklyInventory[week] || 0,
        distributor: currentPlayers[2].weeklyInventory[week] || 0,
        manufacturer: currentPlayers[3].weeklyInventory[week] || 0,
        retailerBackorder: currentPlayers[0].weeklyBackorder[week] || 0,
        wholesalerBackorder: currentPlayers[1].weeklyBackorder[week] || 0,
        distributorBackorder: currentPlayers[2].weeklyBackorder[week] || 0,
        manufacturerBackorder: currentPlayers[3].weeklyBackorder[week] || 0,
        retailerCost: currentPlayers[0].weeklyCosts[week] || 0,
        wholesalerCost: currentPlayers[1].weeklyCosts[week] || 0,
        distributorCost: currentPlayers[2].weeklyCosts[week] || 0,
        manufacturerCost: currentPlayers[3].weeklyCosts[week] || 0,
      });
    }

    setSimulationResult({
      players: currentPlayers,
      totalCosts,
      overallTotalCost: totalCosts.reduce((sum, cost) => sum + cost, 0),
      chartData,
    });
  };

  // テキストエリアの更新ハンドラ
  const updatePlayerActions = (value: string) => {
    setActionsView(value);
    const lines = value
      .split("\n")
      .filter((line: string) => line.trim() !== "");
    setGameConfig({
      ...gameConfig,
      playerActions: lines,
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-800">
        ビールゲーム シミュレーター
      </h1>

      {!isClient ? (
        <div className="text-center p-4">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">ゲーム設定</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ゲーム期間（週）
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={gameConfig.weeks}
                  onChange={(e) =>
                    setGameConfig({
                      ...gameConfig,
                      weeks: parseInt(e.target.value) || 20,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  小売店需要 最小値
                </label>
                <input
                  type="number"
                  min="0"
                  value={gameConfig.retailerOrderMin}
                  onChange={(e) =>
                    setGameConfig({
                      ...gameConfig,
                      retailerOrderMin: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  小売店需要 最大値
                </label>
                <input
                  type="number"
                  min="0"
                  value={gameConfig.retailerOrderMax}
                  onChange={(e) =>
                    setGameConfig({
                      ...gameConfig,
                      retailerOrderMax: parseInt(e.target.value) || 20,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">各週のプレイヤー行動</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    各行に「小売店,卸売業者,販売代理店,製造業者」の注文数をカンマ区切りで入力してください
                  </label>
                  <textarea
                    value={actionsView}
                    onChange={(e) => updatePlayerActions(e.target.value)}
                    rows={Math.max(8, gameConfig.weeks)}
                    className="w-full p-3 border rounded-lg font-mono text-sm"
                    placeholder={
                      actionsView
                        ? undefined
                        : "4,4,4,4\n4,4,4,4\n6,5,4,4\n8,6,5,4"
                    }
                  />
                  <div className="text-sm text-gray-500 mt-2">
                    例: 4,4,4,4 (各プレイヤーが4単位ずつ注文)
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">小売店需要推移</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={retailerDemands.map((demand, index) => ({
                        week: index + 1,
                        demand: demand,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="demand"
                        stroke="#8884d8"
                        name="需要量"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <button
              onClick={runSimulation}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              シミュレーション実行
            </button>
          </div>

          {simulationResult && (
            <div className="space-y-6">
              {/* 総コスト表示 */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">
                  シミュレーション結果
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {["小売店", "卸売業者", "販売代理店", "製造業者"].map(
                    (name, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 p-4 rounded text-center"
                      >
                        <h3 className="font-medium text-gray-700">{name}</h3>
                        <p className="text-2xl font-bold text-red-600">
                          ${simulationResult.totalCosts[index].toFixed(2)}
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="text-center bg-blue-50 p-4 rounded">
                  <h3 className="text-lg font-medium text-gray-700">
                    総コスト
                  </h3>
                  <p className="text-3xl font-bold text-blue-600">
                    ${simulationResult.overallTotalCost.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* 在庫推移グラフ */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">在庫レベル推移</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={simulationResult.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="retailer"
                      stroke="#8884d8"
                      name="小売店"
                    />
                    <Line
                      type="monotone"
                      dataKey="wholesaler"
                      stroke="#82ca9d"
                      name="卸売業者"
                    />
                    <Line
                      type="monotone"
                      dataKey="distributor"
                      stroke="#ffc658"
                      name="販売代理店"
                    />
                    <Line
                      type="monotone"
                      dataKey="manufacturer"
                      stroke="#ff7300"
                      name="製造業者"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 週間コストグラフ */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">週間コスト推移</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={simulationResult.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="retailerCost"
                      stackId="a"
                      fill="#8884d8"
                      name="小売店"
                    />
                    <Bar
                      dataKey="wholesalerCost"
                      stackId="a"
                      fill="#82ca9d"
                      name="卸売業者"
                    />
                    <Bar
                      dataKey="distributorCost"
                      stackId="a"
                      fill="#ffc658"
                      name="販売代理店"
                    />
                    <Bar
                      dataKey="manufacturerCost"
                      stackId="a"
                      fill="#ff7300"
                      name="製造業者"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 欠品数推移グラフ */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">欠品数推移</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={simulationResult.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="retailerBackorder"
                      stroke="#8884d8"
                      name="小売店"
                    />
                    <Line
                      type="monotone"
                      dataKey="wholesalerBackorder"
                      stroke="#82ca9d"
                      name="卸売業者"
                    />
                    <Line
                      type="monotone"
                      dataKey="distributorBackorder"
                      stroke="#ffc658"
                      name="販売代理店"
                    />
                    <Line
                      type="monotone"
                      dataKey="manufacturerBackorder"
                      stroke="#ff7300"
                      name="製造業者"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
            <h3 className="font-medium text-yellow-800">使用方法</h3>
            <ul className="text-sm text-yellow-700 mt-2 space-y-1">
              <li>• ゲーム期間と小売店需要の範囲を設定</li>
              <li>
                • 各週の各プレイヤーの注文数をカンマ区切りで入力（例: 4,6,5,4）
              </li>
              <li>
                • 在庫保管コスト: 0.5ドル/単位/週、欠品コスト: 1.0ドル/単位/週
              </li>
              <li>• 注文から納品まで2週間のリードタイム</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default BeerGameSimulator;
