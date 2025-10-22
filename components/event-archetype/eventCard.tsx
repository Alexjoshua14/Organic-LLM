"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, MapPin } from "lucide-react";
import { z } from "zod";

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  date: z.string(),
  time: z.string().optional(),
  dateRange: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export interface Event extends z.infer<typeof EventSchema> {}

interface EventCardProps {
  event: Event;
  variant?: "card" | "compact";
  isExpanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}

export function EventCard({
  event,
  variant = "card",
  isExpanded = false,
  onExpand,
  onCollapse,
}: EventCardProps) {
  const handleCardClick = () => {
    if (!isExpanded && onExpand) {
      onExpand();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCollapse) {
      onCollapse();
    }
  };

  // Truncate summary to 40 words
  const truncatedSummary =
    event.summary.split(" ").slice(0, 40).join(" ") +
    (event.summary.split(" ").length > 40 ? "..." : "");

  return (
    <AnimatePresence>
      <motion.div
        layout
        animate={{
          opacity: 1,
          y: 0,
          zIndex: isExpanded ? 50 : 1,
          position: isExpanded ? "fixed" : "relative",
          top: isExpanded ? 0 : "auto",
          left: isExpanded ? 0 : "auto",
          right: isExpanded ? 0 : "auto",
          bottom: isExpanded ? 0 : "auto",
          width: isExpanded ? "100vw" : "auto",
          height: isExpanded ? "100vh" : "auto",
        }}
        className={`
          relative overflow-hidden cursor-pointer group
          ${isExpanded ? "cursor-default" : ""}
        `}
        exit={{ opacity: 0, y: -20 }}
        initial={{ opacity: 0, y: 20 }}
        style={{
          aspectRatio: !isExpanded && variant === "card" ? "4/3" : "auto",
        }}
        transition={{
          duration: 0.4,
          ease: [0.23, 1, 0.32, 1],
          layout: { duration: 0.4 },
        }}
        onClick={handleCardClick}
      >
        {/* Glass morphism background */}
        <motion.div
          animate={{
            borderRadius: isExpanded ? 0 : "1rem",
          }}
          className="absolute inset-0 backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
          style={{
            borderRadius: isExpanded ? 0 : "1rem",
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />

        {/* Content */}
        <motion.div
          animate={{
            padding: isExpanded ? "2rem" : "1.5rem",
          }}
          className="relative z-10 p-6 h-full flex flex-col"
          transition={{ duration: 0.4 }}
        >
          {/* Header with title and date */}
          <div className="flex justify-between items-start mb-4">
            <motion.h3
              animate={{
                fontSize: isExpanded ? "2.5rem" : "1.25rem",
                fontWeight: 600,
              }}
              className="text-white pr-4 leading-tight"
              transition={{ duration: 0.4 }}
            >
              {event.title}
            </motion.h3>

            <div className="flex flex-col items-end text-right shrink-0">
              <motion.div
                animate={{
                  fontSize: isExpanded ? "1rem" : "0.875rem",
                }}
                className="text-white/90 text-sm mb-1"
                transition={{ duration: 0.4 }}
              >
                {event.dateRange || event.date}
              </motion.div>
              {event.time && (
                <motion.div
                  animate={{
                    fontSize: isExpanded ? "0.875rem" : "0.75rem",
                  }}
                  className="text-white/70 text-xs flex items-center gap-1"
                  transition={{ duration: 0.4 }}
                >
                  <Clock size={12} />
                  {event.time}
                </motion.div>
              )}
            </div>
          </div>

          {/* Category badge */}
          {event.category && (
            <motion.div
              animate={{
                opacity: isExpanded ? 1 : 0.8,
              }}
              className="inline-flex w-fit mb-4"
            >
              <span className="px-3 py-1 bg-white/20 text-white text-xs rounded-full backdrop-blur-sm">
                {event.category}
              </span>
            </motion.div>
          )}

          {/* Summary */}
          <motion.p
            animate={{
              fontSize: isExpanded ? "1.125rem" : "0.875rem",
              lineHeight: isExpanded ? 1.6 : 1.5,
            }}
            className="text-white/90 mb-4 flex-grow"
            transition={{ duration: 0.4 }}
          >
            {isExpanded ? event.summary : truncatedSummary}
          </motion.p>

          {/* Location */}
          {event.location && (
            <motion.div
              animate={{
                opacity: isExpanded ? 1 : 0.8,
                y: 0,
                fontSize: isExpanded ? "1rem" : "0.75rem",
              }}
              className="flex items-center gap-2 text-white/70 mt-auto"
              initial={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4, delay: isExpanded ? 0.2 : 0 }}
            >
              <MapPin size={isExpanded ? 16 : 14} />
              {event.location}
            </motion.div>
          )}

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 space-y-6"
                exit={{ opacity: 0, y: 20 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                {event.description && (
                  <div>
                    <h4 className="text-white text-lg mb-3">
                      About This Event
                    </h4>
                    <p className="text-white/80 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                )}

                <div className="flex gap-4 pt-6">
                  <button className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors">
                    Register Now
                  </button>
                  <button className="px-6 py-3 bg-transparent hover:bg-white/10 text-white border border-white/30 rounded-lg transition-colors">
                    Learn More
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Close button for expanded state */}
        <AnimatePresence>
          {isExpanded && (
            <motion.button
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-6 right-6 z-20 p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors"
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, delay: 0.2 }}
              onClick={handleCloseClick}
            >
              <X className="text-white" size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Hover effect for non-expanded cards */}
        {!isExpanded && (
          <motion.div
            className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              borderRadius: "1rem",
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
