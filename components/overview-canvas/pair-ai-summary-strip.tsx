"use client";

import { useCallback, useState } from "react";
import { IconChevronDown, IconSparkle } from "@/components/icons";
import type { LeadAiSummaryStripInsight } from "@/lib/crm/ai-summary-strip";

const ink = "rgb(22, 20, 15)";
const bodyMuted = "rgb(111, 103, 92)";
const bodyDark = "rgb(42, 38, 30)";
const labelBlue = "rgb(15, 107, 92)";

const pairGradientFrameStyle = {
  backgroundImage:
    "linear-gradient(rgba(255, 253, 248, 0.92), rgba(255, 253, 248, 0.92)), linear-gradient(109.4deg, rgb(196, 165, 116) -9.52%, rgb(15, 107, 92) 55.34%, rgb(196, 92, 38) 125.99%)",
} as const;

function AiGeneratedSummaryChrome() {
  return (
    <>
      <div className="flex flex-row items-center gap-1.5">
        <span
          className="mb-0.5 mr-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, rgb(15, 107, 92), rgb(196, 92, 38))",
          }}
        >
          <IconSparkle className="size-4 text-white" />
        </span>
        <span
          className="ml-1 shrink-0 text-[15px] font-semibold tracking-tight"
          style={{
            backgroundImage: "linear-gradient(90deg, rgb(15, 107, 92), rgb(196, 92, 38))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          AI Generated Summary
        </span>
      </div>
      <div className="my-2 h-[0.8px] w-full shrink-0" style={{ backgroundColor: "rgb(228, 217, 200)" }} />
    </>
  );
}

const SCORE_CARDS = [
  {
    title: "Perception" as const,
    bg: "rgb(253, 240, 171)",
    border: "rgb(214, 185, 29)",
    detailText:
      "The customer does not express any opinions or ask questions about the builder's credibility, project quality, or reputation. Therefore, based on the definition, a score of NA is assigned.",
  },
  {
    title: "Ability" as const,
    bg: "rgb(194, 250, 213)",
    border: "rgb(97, 195, 124)",
    detailText:
      "There is not enough conversation data to assess the lead's financial capacity, decision-making authority, or ability to proceed. A score of NA is assigned until more signals are available.",
  },
  {
    title: "Intent" as const,
    bg: "rgb(197, 235, 255)",
    border: "rgb(56, 127, 210)",
    detailText:
      "The lead has not yet stated clear purchase intent, timeline, or product preferences in captured interactions. Based on the rubric, a score of NA is assigned.",
  },
  {
    title: "Readiness" as const,
    bg: "rgb(255, 180, 164)",
    border: "rgb(252, 83, 89)",
    detailText:
      "Readiness to move forward (documentation, visits, or next steps) cannot be determined from current data. A score of NA is assigned pending further engagement.",
  },
];

type PairTitle = (typeof SCORE_CARDS)[number]["title"];

type Props = {
  insight: LeadAiSummaryStripInsight | null;
  sections?: "full" | "scores" | "summary";
};

/** Four PAIR score chips (expandable) plus AI Generated Summary — matches widgets-config-v2. */
export function PairAiSummaryStrip({ insight, sections = "full" }: Props) {
  const hasInsight = insight !== null;
  const summaryBody = hasInsight
    ? insight.summaryBody
    : "No summary available yet, The AI will generate insights once data is added.";
  const nextSteps = hasInsight ? insight.nextSteps : null;
  const lastUpdated = hasInsight ? insight.lastUpdatedLabel : null;

  const [expanded, setExpanded] = useState<PairTitle | null>(null);

  const toggleCard = useCallback((title: PairTitle) => {
    setExpanded((prev) => (prev === title ? null : title));
  }, []);

  const expandedConfig = expanded ? SCORE_CARDS.find((c) => c.title === expanded) : undefined;
  const showScores = sections !== "summary";
  const showSummary = sections !== "scores";
  const hasExpandedScore = expanded !== null;

  return (
    <div className="w-full min-w-0 shrink-0">
      {showScores ? (
        <div className="flex w-full min-w-0 flex-wrap gap-1 sm:gap-1.5">
          {SCORE_CARDS.map((card) => {
            const isOpen = expanded === card.title;
            const isDimmed = hasExpandedScore && !isOpen;
            return (
              <div
                key={card.title}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-current={isOpen ? "true" : undefined}
                aria-controls={isOpen ? `pair-rationale-${card.title}` : undefined}
                aria-label={`${card.title}, score NA out of 5. ${isOpen ? "Collapse" : "Expand"} rationale.`}
                className={`flex min-w-0 max-w-full flex-[1_1_min(100%,9.5rem)] cursor-pointer items-stretch rounded-lg px-2 py-1.5 outline-none transition-[box-shadow,opacity,ring] duration-200 ring-[#34369C] focus-visible:ring-2 sm:rounded-xl sm:px-2.5 sm:py-2 ${
                  isOpen
                    ? "z-[1] shadow-[0_4px_14px_-4px_rgba(52,54,156,0.35)] ring-2 ring-[#34369C] ring-offset-2 ring-offset-white"
                    : isDimmed
                      ? "opacity-55"
                      : ""
                }`}
                style={{
                  backgroundColor: card.bg,
                  borderColor: card.border,
                  borderStyle: "solid",
                  borderWidth: isOpen ? 2 : 0,
                }}
                onClick={() => toggleCard(card.title)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCard(card.title);
                  }
                }}
              >
                <div className="flex w-full min-w-0 flex-col gap-0.5">
                  <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 sm:gap-x-2">
                      <div className="text-xs font-semibold sm:text-sm" style={{ color: ink }}>
                        {card.title}
                      </div>
                      <div className="shrink-0 text-sm font-semibold sm:text-base" style={{ color: ink }}>
                        NA
                        <span className="ml-0.5 text-[10px] font-medium sm:text-xs" style={{ color: ink }}>
                          /5
                        </span>
                      </div>
                    </div>
                    <IconChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 sm:h-4 sm:w-4 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      style={{ color: ink }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {showScores && expandedConfig ? (
        <div
          id={`pair-rationale-${expandedConfig.title}`}
          role="region"
          aria-label={`${expandedConfig.title} score rationale`}
          className="mt-3 flex w-full flex-col rounded-[1.75rem] border-[0.0875rem] border-transparent bg-origin-border p-4 [background-clip:padding-box,border-box] sm:mt-4"
          style={pairGradientFrameStyle}
        >
          <AiGeneratedSummaryChrome />
          <div className="mt-1 flex">
            <span
              className="mr-2 mt-2 size-[5px] shrink-0 rounded-full"
              style={{ backgroundColor: bodyDark }}
              aria-hidden
            />
            <span className="w-full text-sm font-normal" style={{ color: labelBlue }}>
              <span className="text-sm font-normal leading-snug" style={{ color: bodyDark }}>
                {expandedConfig.detailText}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {showSummary ? (
        <div
          className={`w-full rounded-[1.75rem] border-[0.0875rem] border-transparent bg-origin-border p-4 [background-clip:padding-box,border-box] ${
            showScores ? "mt-3 sm:mt-4" : "mt-0"
          }`}
          style={pairGradientFrameStyle}
        >
          <AiGeneratedSummaryChrome />

          <div className="max-h-[min(22vh,9.5rem)] overflow-y-auto pr-0.5 [scrollbar-width:thin] sm:max-h-[min(26vh,11rem)] lg:max-h-[min(28vh,12rem)]">
            <div className="mt-1 flex">
              <span
                className="mr-2 mt-2 size-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: hasInsight ? bodyDark : bodyMuted }}
                aria-hidden
              />
              <span className="w-full text-sm font-normal" style={{ color: labelBlue }}>
                <span
                  className="text-sm font-normal leading-snug"
                  style={{ color: hasInsight ? bodyDark : bodyMuted }}
                >
                  {summaryBody}
                </span>
              </span>
            </div>

            {nextSteps ? (
              <div className="mt-1 flex">
                <span
                  className="mr-2 mt-2 size-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: labelBlue }}
                  aria-hidden
                />
                <span className="w-full text-sm font-normal" style={{ color: labelBlue }}>
                  Next Steps :{" "}
                  <span className="text-sm font-normal" style={{ color: bodyDark }}>
                    {nextSteps}
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          {lastUpdated ? (
            <div className="mt-2 flex w-full justify-end">
              <span className="text-right text-xs font-medium" style={{ color: "rgb(126, 122, 149)" }}>
                Last Updated on: {lastUpdated}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
