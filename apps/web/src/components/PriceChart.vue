<script setup lang="ts">
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ bars: Array<{ endTime: string; close: string }> }>();
const element = ref<HTMLDivElement>(); let chart: echarts.EChartsType | null = null;
function render() {
  if (!element.value) return;
  chart ??= echarts.init(element.value);
  chart.setOption({
    animation: false,
    grid: { left: 48, right: 18, top: 20, bottom: 35 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: props.bars.map((bar) => bar.endTime.slice(0, 10)), axisLabel: { color: "#8291a7", hideOverlap: true } },
    yAxis: { type: "value", scale: true, axisLabel: { color: "#8291a7" }, splitLine: { lineStyle: { color: "rgba(130,145,167,.12)" } } },
    series: [{ type: "line", data: props.bars.map((bar) => Number(bar.close)), showSymbol: false, smooth: 0.16, lineStyle: { color: "#43d9ad", width: 2 }, areaStyle: { color: "rgba(67,217,173,.12)" } }],
  });
}
const resize = () => chart?.resize();
onMounted(() => { render(); window.addEventListener("resize", resize); });
watch(() => props.bars, () => { void nextTick(render); }, { deep: true });
onBeforeUnmount(() => { window.removeEventListener("resize", resize); chart?.dispose(); });
</script>

<template><div ref="element" class="price-chart" role="img" aria-label="合成历史价格走势图"></div></template>
