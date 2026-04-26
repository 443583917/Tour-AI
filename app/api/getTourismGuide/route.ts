import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const IFLYTEK_API_KEY = process.env.IFLYTEK_API_KEY;
const IFLYTEK_API_SECRET = process.env.IFLYTEK_API_SECRET;
const AMAP_API_KEY = process.env.AMAP_API_KEY;
const APIPassword = process.env.APIPassword;
const IMAGE_API_ID = process.env.IMAGE_API_ID;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY;
const QWEN_API_KEY = process.env.QWEN_API_KEY;

interface Place {
  name: string;
  description: string;
  image: string;
  visitDuration?: string;
  commuteTime?: string;
  ticketRequired?: boolean;
  ticketPrice?: string;
  transportMode?: string;
  bestTimeToVisit?: string;
  tips?: string;
}

// 图片缓存 - 避免重复请求
const imageCache = new Map<string, string>();

// 带超时的 fetch 工具函数
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 55000
) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// 获取推荐景点（千问 API）
const getRecommendedPlacesFromQwen = async (
  city: string,
  keyword: string,
  days: number
): Promise<{ day: number; places: Place[] }[]> => {
  console.log("请求千问API：", { city, days, keyword });

  try {
    const response = await fetchWithTimeout(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${QWEN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-turbo",
          messages: [
            {
              role: "system",
              content:
                "你是一位资深的旅行规划师，拥有丰富的中国旅游经验。你熟悉各城市的历史文化、自然风光、美食特色和现代地标。你的任务是为游客制定个性化、实用且有趣的旅行攻略。推荐的地点必须真实存在，具有代表性和游览价值。注意：行程中的地点不限于景点，根据用户的兴趣可以包含餐厅、小吃街、美食体验、购物场所、演出场所等各类旅行目的地。",
            },
            {
              role: "user",
              content: `请为我在${city}规划一个${days}天的旅行攻略，重点推荐与"${keyword}"相关的热门地点。

行程安排要求：
- 根据关键词选择合适的地点类型：如果关键词包含"美食"，请推荐特色餐厅、小吃街、美食体验等；如果包含"购物"，请推荐商业街、购物中心等；如果包含"艺术"，请推荐美术馆、艺术展览等。不要只推荐传统景点。
- 如果关键词包含"美食"，行程中应穿插安排餐厅用餐（如早餐店、午餐餐厅、晚餐餐厅、小吃街、宵夜等），让美食贯穿全天行程。
- 考虑地点之间的地理位置，合理安排游览/用餐顺序
- 每个地点提供简洁准确的描述（20-50字），突出其特色和亮点
- 时间控制：每天的总时间（游览/用餐时间 + 通勤时间）控制在8小时左右，合理安排每天地点数量

每个地点需要包含以下详细信息：
- name: 地点名称（如餐厅名、景点名、商场名等）
- description: 地点特色描述（20-50字）
- visitDuration: 建议停留时长（如：2-3小时、1-2小时、30分钟-1小时）
- commuteTime: 从上一个地点的通勤时间（如：30分钟、1小时，第一个地点填"起点"）
- ticketRequired: 是否需要门票/费用（true/false）
- ticketPrice: 费用（如：免费、50元、人均80-120元）
- transportMode: 推荐交通方式（如：地铁、公交、打车、步行）
- bestTimeToVisit: 最佳时间（如：上午、中午、下午、傍晚、全天）
- tips: 实用小贴士（1-2条实用建议）

请直接返回以下格式的 JSON 字符串，不要包含任何多余的文本、Markdown 标记或其他内容：
[
  { 
    "day": 1, 
    "places": [{ 
      "name": "景点名称", 
      "description": "景点特色描述",
      "visitDuration": "建议游览时长",
      "commuteTime": "通勤时间",
      "ticketRequired": true/false,
      "ticketPrice": "门票价格",
      "transportMode": "交通方式",
      "bestTimeToVisit": "最佳游览时间",
      "tips": "游览小贴士"
    }] 
  },
  { 
    "day": 2, 
    "places": [{ 
      "name": "景点名称", 
      "description": "景点特色描述",
      "visitDuration": "建议游览时长",
      "commuteTime": "通勤时间",
      "ticketRequired": true/false,
      "ticketPrice": "门票价格",
      "transportMode": "交通方式",
      "bestTimeToVisit": "最佳游览时间",
      "tips": "游览小贴士"
    }] 
  }
]`,
            },
          ],
          max_tokens: 1500,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`千问 API 请求失败，状态码: ${response.status}`);
    }

    const data = await response.json();
    console.log("千问完整响应:", data);

    if (!data || !data.choices || !data.choices[0]?.message?.content) {
      throw new Error("千问 API 返回的数据无效或为空");
    }

    const content = data.choices[0].message.content.trim();
    if (!content) {
      throw new Error("千问 API 返回内容为空");
    }

    let cleanedContent = content.replace(/^```json/, "").replace(/```$/, "");
    let itinerary;
    try {
      itinerary = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("JSON 解析失败，尝试手动提取数据:", parseError);
      const placePattern =
        /"name":\s*"([^"]+)"[^}]*"description":\s*"([^"]+)"/g;
      const matches = [...cleanedContent.matchAll(placePattern)];

      if (matches.length === 0) {
        throw new Error("无法从千问 API 提取有效景点数据");
      }

      itinerary = Array.from({ length: days }, (_, day) => ({
        day: day + 1,
        places: matches.slice(day * 2, (day + 1) * 2).map((match) => ({
          name: match[1],
          description: match[2],
          image: "/default.jpg",
          visitDuration: "2-3小时",
          commuteTime: day === 0 && matches.indexOf(match) === day * 2 ? "起点" : "30分钟",
          ticketRequired: false,
          ticketPrice: "免费",
          transportMode: "地铁",
          bestTimeToVisit: "全天",
          tips: "建议提前查询开放时间",
        })),
      }));
    }

    if (!Array.isArray(itinerary)) {
      throw new Error("千问 API 返回的行程数据格式错误");
    }

    if (itinerary.length !== days) {
      console.warn(
        `千问 API 返回的天数 (${itinerary.length}) 不匹配请求天数 (${days})`
      );
      itinerary = itinerary.slice(0, days);
    }

    console.log(`成功解析 ${itinerary.length} 天行程`);
    return itinerary;
  } catch (error) {
    console.error("解析千问数据失败:", error);
    throw error;
  }
};

// 获取景点图片（带缓存）
const fetchPlaceImage = async (
  city: string,
  placeName: string
): Promise<string> => {
  const cacheKey = `${city}-${placeName}`;
  
  // 检查缓存
  if (imageCache.has(cacheKey)) {
    console.log(`使用缓存图片: ${placeName}`);
    return imageCache.get(cacheKey)!;
  }

  const amapUrl = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(
    placeName
  )}&city=${encodeURIComponent(city)}&extensions=all&key=${AMAP_API_KEY}`;

  try {
    const response = await fetchWithTimeout(amapUrl, {}, 1500);
    const data = await response.json();

    if (data.status === "1" && data.pois?.length > 0) {
      const photos = data.pois[0].photos || [];
      if (photos.length > 0) {
        const imageUrl = photos[0].url;
        imageCache.set(cacheKey, imageUrl);
        return imageUrl;
      }
    }
  } catch (error) {
    console.error(`高德 API 获取 ${placeName} 图片失败`, error);
  }

  // 备用 API
  const backupApiUrl = `https://cn.apihz.cn/api/img/apihzimgbaidu.php?id=${IMAGE_API_ID}&key=${IMAGE_API_KEY}&words=${encodeURIComponent(
    placeName
  )}&limit=1&page=1`;

  try {
    const backupResponse = await fetchWithTimeout(backupApiUrl, {}, 1500);
    const backupData = await backupResponse.json();
    if (backupData.code === 200 && backupData.res?.length > 0) {
      const imageUrl = backupData.res[0];
      imageCache.set(cacheKey, imageUrl);
      return imageUrl;
    }
  } catch (backupError) {
    console.error(`备用API获取 ${placeName} 图片失败:`, backupError);
  }

  // 缓存默认图片
  imageCache.set(cacheKey, "/default.jpg");
  return "/default.jpg";
};

// 并行获取所有景点图片 - 优化版本，带总体超时控制
const fetchAllPlaceImages = async (
  city: string,
  itinerary: { day: number; places: Place[] }[]
): Promise<{ day: number; places: Place[] }[]> => {
  // 收集所有需要获取图片的地点
  const allPlaces: { dayIndex: number; placeIndex: number; place: Place }[] = [];
  
  itinerary.forEach((day, dayIndex) => {
    day.places.forEach((place, placeIndex) => {
      allPlaces.push({ dayIndex, placeIndex, place });
    });
  });

  console.log(`开始并行获取 ${allPlaces.length} 个地点的图片...`);
  const startTime = Date.now();

  // 设置总体超时时间为 15 秒（千问 API 可能占用较长时间）
  const TOTAL_TIMEOUT = 15000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('图片获取总体超时')), TOTAL_TIMEOUT);
  });

  // 图片获取任务
  const fetchTask = async () => {
    // 增加并发数到 10，减少总体时间
    const batchSize = 10;
    for (let i = 0; i < allPlaces.length; i += batchSize) {
      const batch = allPlaces.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ dayIndex, placeIndex, place }) => {
          const image = await fetchPlaceImage(city, place.name);
          itinerary[dayIndex].places[placeIndex].image = image;
        })
      );
      console.log(`已完成 ${Math.min(i + batchSize, allPlaces.length)}/${allPlaces.length} 个地点`);
    }
    return itinerary;
  };

  try {
    const result = await Promise.race([fetchTask(), timeoutPromise]);
    const endTime = Date.now();
    console.log(`图片获取完成，耗时: ${(endTime - startTime) / 1000}秒`);
    return result;
  } catch (error) {
    console.warn('图片获取超时或失败，使用默认图片:', error);
    // 超时后，为所有未设置图片的地点设置默认图片
    allPlaces.forEach(({ dayIndex, placeIndex, place }) => {
      if (!itinerary[dayIndex].places[placeIndex].image) {
        itinerary[dayIndex].places[placeIndex].image = "/default.jpg";
      }
    });
    return itinerary;
  }
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get("city");
  let keyword = url.searchParams.get("keyword") || "";
  const days = Math.max(parseInt(url.searchParams.get("days") || "1", 10), 1);

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return new Response(JSON.stringify({ message: "未登录或会话无效" }), {
      status: 401,
    });
  }
  const userId = session.user.id;

  if (!keyword) {
    keyword = "历史文化景点、自然风光、现代地标、特色街区、美食体验";
  }

  if (!city || !AMAP_API_KEY || !IFLYTEK_API_KEY || !IFLYTEK_API_SECRET) {
    return new Response(JSON.stringify({ message: "城市名称或API密钥无效" }), {
      status: 400,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return new Response(JSON.stringify({ message: "用户不存在" }), {
        status: 404,
      });
    }

    const totalItineraries = await prisma.itinerary.count({
      where: { userId },
    });

    if (totalItineraries >= 9) {
      return new Response(
        JSON.stringify({
          message:
            "您已达到6个行程的上限，无法添加新行程,请去我的行程中删除行程",
        }),
        { status: 403 }
      );
    }

    const startTime = Date.now();
    
    // 1. 获取行程数据
    let itinerary = await getRecommendedPlacesFromQwen(city, keyword, days);
    console.log(`API 生成的行程天数: ${itinerary.length}`);

    // 2. 并行获取所有图片
    const updatedItinerary = await fetchAllPlaceImages(city, itinerary);

    // 3. 保存到数据库
    const savedItinerary = await prisma.itinerary.create({
      data: {
        userId,
        city,
        schedule: updatedItinerary,
        generatedAt: new Date(),
      },
    });

    const endTime = Date.now();
    console.log(`总耗时: ${(endTime - startTime) / 1000}秒`);
    console.log(`最终返回的行程天数: ${updatedItinerary.length}`);

    return new Response(
      JSON.stringify({
        id: savedItinerary.id,
        city,
        schedule: updatedItinerary,
        generatedAt: savedItinerary.generatedAt.toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("生成旅游攻略失败:", error);
    return new Response(
      JSON.stringify({
        message: "生成旅游攻略失败",
        error: error || String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

export async function POST(req: Request) {
  const { id, city, schedule } = await req.json();

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return new Response(JSON.stringify({ message: "未登录或会话无效" }), {
      status: 401,
    });
  }
  const userId = session.user.id;

  if (!id) {
    return new Response(JSON.stringify({ message: "缺少行程ID" }), {
      status: 400,
    });
  }

  try {
    const updatedItinerary = await prisma.itinerary.update({
      where: { id },
      data: {
        city,
        schedule,
        updatedAt: new Date(),
      },
    });

    return new Response(
      JSON.stringify({
        id: updatedItinerary.id,
        city: updatedItinerary.city,
        schedule: updatedItinerary.schedule,
        generatedAt: updatedItinerary.generatedAt.toISOString(),
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("更新旅游攻略失败:", error);
    return new Response(
      JSON.stringify({ message: "更新旅游攻略失败", error: String(error) }),
      { status: 500 }
    );
  }
}
