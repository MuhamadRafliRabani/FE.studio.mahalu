<script lang="ts">
export const iframeHeight = "800px";
export const description =
  "A dashboard with sidebar, data table, and analytics cards.";
</script>

<script setup lang="ts">
import { h, ref } from "vue";
import { createColumnHelper, type ColumnDef } from "@tanstack/vue-table";
import ChartAreaInteractive from "@/components/ChartAreaInteractive.vue";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { IconGripVertical } from "@tabler/icons-vue";
import DataTable from "@/components/data-table/DataTable.vue";
import DataTableColumnHeader from "@/components/data-table/DataTableColumnHeader.vue";
import DataTableToolbar from "@/components/data-table/DataTableToolbar.vue";
import SectionCards from "@/components/SectionCards.vue";

interface DashboardRow {
  id: number;
  header: string;
  type: string;
  status: "In Process" | "Done";
  target: string;
  limit: string;
  reviewer: string;
}

const data = ref<DashboardRow[]>([
  {
    id: 1,
    header: "Cover page",
    type: "Cover page",
    status: "In Process",
    target: "18",
    limit: "5",
    reviewer: "Eddie Lake",
  },
  {
    id: 2,
    header: "Table of contents",
    type: "Table of contents",
    status: "Done",
    target: "29",
    limit: "24",
    reviewer: "Eddie Lake",
  },
  {
    id: 3,
    header: "Executive summary",
    type: "Narrative",
    status: "Done",
    target: "10",
    limit: "13",
    reviewer: "Eddie Lake",
  },
  {
    id: 4,
    header: "Technical approach",
    type: "Narrative",
    status: "Done",
    target: "27",
    limit: "23",
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 5,
    header: "Design",
    type: "Narrative",
    status: "In Process",
    target: "2",
    limit: "16",
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 6,
    header: "Capabilities",
    type: "Narrative",
    status: "In Process",
    target: "20",
    limit: "8",
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 7,
    header: "Integration with existing systems",
    type: "Narrative",
    status: "In Process",
    target: "19",
    limit: "21",
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 8,
    header: "Innovation and Advantages",
    type: "Narrative",
    status: "Done",
    target: "25",
    limit: "26",
    reviewer: "Assign reviewer",
  },
  {
    id: 9,
    header: "Overview of EMR's Innovative Solutions",
    type: "Technical content",
    status: "Done",
    target: "7",
    limit: "23",
    reviewer: "Assign reviewer",
  },
  {
    id: 10,
    header: "Advanced Algorithms and Machine Learning",
    type: "Narrative",
    status: "Done",
    target: "30",
    limit: "28",
    reviewer: "Assign reviewer",
  },
  {
    id: 11,
    header: "Adaptive Communication Protocols",
    type: "Narrative",
    status: "Done",
    target: "9",
    limit: "31",
    reviewer: "Assign reviewer",
  },
  {
    id: 12,
    header: "Advantages Over Current Technologies",
    type: "Narrative",
    status: "Done",
    target: "12",
    limit: "0",
    reviewer: "Assign reviewer",
  },
  {
    id: 13,
    header: "Past Performance",
    type: "Narrative",
    status: "Done",
    target: "22",
    limit: "33",
    reviewer: "Assign reviewer",
  },
  {
    id: 14,
    header: "Customer Feedback and Satisfaction Levels",
    type: "Narrative",
    status: "Done",
    target: "15",
    limit: "34",
    reviewer: "Assign reviewer",
  },
  {
    id: 15,
    header: "Implementation Challenges and Solutions",
    type: "Narrative",
    status: "Done",
    target: "3",
    limit: "35",
    reviewer: "Assign reviewer",
  },
  {
    id: 16,
    header: "Security Measures and Data Protection Policies",
    type: "Narrative",
    status: "In Process",
    target: "6",
    limit: "36",
    reviewer: "Assign reviewer",
  },
  {
    id: 17,
    header: "Scalability and Future Proofing",
    type: "Narrative",
    status: "Done",
    target: "4",
    limit: "37",
    reviewer: "Assign reviewer",
  },
  {
    id: 18,
    header: "Cost-Benefit Analysis",
    type: "Plain language",
    status: "Done",
    target: "14",
    limit: "38",
    reviewer: "Assign reviewer",
  },
  {
    id: 19,
    header: "User Training and Onboarding Experience",
    type: "Narrative",
    status: "Done",
    target: "17",
    limit: "39",
    reviewer: "Assign reviewer",
  },
  {
    id: 20,
    header: "Future Development Roadmap",
    type: "Narrative",
    status: "Done",
    target: "11",
    limit: "40",
    reviewer: "Assign reviewer",
  },
  {
    id: 21,
    header: "System Architecture Overview",
    type: "Technical content",
    status: "In Process",
    target: "24",
    limit: "18",
    reviewer: "Maya Johnson",
  },
  {
    id: 22,
    header: "Risk Management Plan",
    type: "Narrative",
    status: "Done",
    target: "15",
    limit: "22",
    reviewer: "Carlos Rodriguez",
  },
  {
    id: 23,
    header: "Compliance Documentation",
    type: "Legal",
    status: "In Process",
    target: "31",
    limit: "27",
    reviewer: "Sarah Chen",
  },
  {
    id: 24,
    header: "API Documentation",
    type: "Technical content",
    status: "Done",
    target: "8",
    limit: "12",
    reviewer: "Raj Patel",
  },
  {
    id: 25,
    header: "User Interface Mockups",
    type: "Visual",
    status: "In Process",
    target: "19",
    limit: "25",
    reviewer: "Leila Ahmadi",
  },
  {
    id: 26,
    header: "Database Schema",
    type: "Technical content",
    status: "Done",
    target: "22",
    limit: "20",
    reviewer: "Thomas Wilson",
  },
  {
    id: 27,
    header: "Testing Methodology",
    type: "Technical content",
    status: "In Process",
    target: "17",
    limit: "14",
    reviewer: "Assign reviewer",
  },
  {
    id: 28,
    header: "Deployment Strategy",
    type: "Narrative",
    status: "Done",
    target: "26",
    limit: "30",
    reviewer: "Eddie Lake",
  },
  {
    id: 29,
    header: "Budget Breakdown",
    type: "Financial",
    status: "In Process",
    target: "13",
    limit: "16",
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 30,
    header: "Market Analysis",
    type: "Research",
    status: "Done",
    target: "29",
    limit: "32",
    reviewer: "Sophia Martinez",
  },
]);

const columnHelper = createColumnHelper<DashboardRow>();
const columns: ColumnDef<DashboardRow, any>[] = [
  columnHelper.display({
    id: "drag",
    header: "",
    cell: () =>
      h(
        "span",
        {
          class:
            "drag-handle text-muted-foreground inline-flex cursor-grab touch-none p-1",
          title: "Geser untuk mengubah urutan",
          "aria-label": "Geser baris",
        },
        [h(IconGripVertical, { class: "size-4" })],
      ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) =>
      h(Checkbox as any, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate"),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(value === true),
        "aria-label": "Pilih semua baris",
      }),
    cell: ({ row }) =>
      h(Checkbox as any, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          row.toggleSelected(value === true),
        "aria-label": "Pilih baris",
      }),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("header", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Header" }),
    enableHiding: false,
  }),
  columnHelper.accessor("type", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Tipe" }),
    cell: ({ getValue }) => h(Badge, { variant: "outline" }, () => getValue()),
  }),
  columnHelper.accessor("status", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Status" }),
    cell: ({ getValue }) => {
      const status = getValue() as DashboardRow["status"];
      return h(
        Badge,
        { variant: status === "Done" ? "default" : "secondary" },
        () => status,
      );
    },
  }),
  columnHelper.accessor("target", {
    header: "Target",
    cell: ({ getValue }) =>
      h("span", { class: "font-mono text-sm" }, getValue()),
  }),
  columnHelper.accessor("limit", {
    header: "Limit",
    cell: ({ getValue }) =>
      h("span", { class: "font-mono text-sm" }, getValue()),
  }),
  columnHelper.accessor("reviewer", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Reviewer" }),
  }),
];

const columnLabels = {
  header: "Header",
  type: "Tipe",
  status: "Status",
  target: "Target",
  limit: "Limit",
  reviewer: "Reviewer",
};

function handleReorder(reorderedRows: DashboardRow[]) {
  data.value = reorderedRows;
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div class="@container/main flex flex-1 flex-col gap-2">
      <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div class="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <div class="px-4! lg:px-6!">
          <DataTable
            :columns="columns"
            :data="data"
            :get-row-id="(row) => String(row.id)"
            enable-row-reorder
            empty-text="Tidak ada data dashboard."
            @reorder="handleReorder"
          >
            <template #toolbar="{ table }">
              <DataTableToolbar
                :table="table"
                search-placeholder="Cari data..."
                :column-labels="columnLabels"
              />
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
