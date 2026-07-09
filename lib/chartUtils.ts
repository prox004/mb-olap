export const CHART_COLORS = {
  red: "#DF1C24",
  blue: "#2563EB",
  purple: "#6D28D9",
  indigo: "#4338CA",
  green: "#10B981",
  amber: "#F59E0B",
  rose: "#F43F5E",
  teal: "#14B8A6",
  sky: "#0EA5E9",
  violet: "#8B5CF6",
};

export function getChartTheme(theme: "light" | "dark") {
  const isDark = theme === "dark";
  return {
    textStyle: {
      color: isDark ? "#A1A1AA" : "#52525B",
      fontFamily: "Outfit, Inter, sans-serif",
      fontSize: 11,
    },
    axisLine: {
      lineStyle: {
        color: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
      },
    },
    splitLine: {
      lineStyle: {
        color: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
      },
    },
    tooltip: {
      backgroundColor: isDark ? "rgba(18, 18, 23, 0.95)" : "rgba(255, 255, 255, 0.95)",
      borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
      borderWidth: 1,
      borderRadius: 8,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowBlur: 10,
      textStyle: {
        color: isDark ? "#F4F4F5" : "#09090B",
      },
    },
    pieBorderColor: isDark ? "#121217" : "#ffffff",
  };
}
