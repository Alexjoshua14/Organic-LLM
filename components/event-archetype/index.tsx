import { EventCard, Event } from "./eventCard";

const mockEvents: Event[] = [
  {
    id: "1",
    title: "Summer Music Festival",
    summary:
      "Join us for an unforgettable night of live music featuring top artists from around the world. Experience multiple stages, food trucks, and an amazing atmosphere under the stars. This festival celebrates diverse musical genres from indie rock to electronic dance music.",
    date: "Jul 15",
    time: "7:00 PM",
    dateRange: "Jul 15-17",
    location: "Central Park, New York",
    category: "Music",
    description:
      "The Summer Music Festival returns for its 10th anniversary with an incredible lineup of artists spanning multiple genres. From emerging indie artists to world-renowned headliners, this three-day celebration of music offers something for everyone. Enjoy gourmet food trucks, local artisan vendors, and interactive installations throughout the festival grounds. VIP packages include exclusive access to artist meet-and-greets and premium viewing areas.",
  },
  {
    id: "2",
    title: "Tech Innovation Summit 2024",
    summary:
      "Discover the future of technology with leading innovators and entrepreneurs. Network with industry professionals and learn about cutting-edge developments in AI, blockchain, and sustainable tech solutions.",
    date: "Aug 22",
    time: "9:00 AM",
    location: "Convention Center, San Francisco",
    category: "Technology",
    description:
      "Join over 5,000 tech professionals, entrepreneurs, and innovators for a day-long summit exploring the technologies that will shape our future. Featuring keynote presentations from industry leaders, hands-on workshops, and networking opportunities with startups and established companies alike. Topics include artificial intelligence, sustainable technology, cybersecurity, and the future of work.",
  },
  {
    id: "3",
    title: "Contemporary Art Exhibition",
    summary:
      "Explore groundbreaking works by emerging contemporary artists. This curated collection showcases innovative approaches to modern art across various mediums.",
    date: "Sep 5",
    dateRange: "Sep 5 - Oct 20",
    location: "Modern Art Gallery, Chelsea",
    category: "Art",
    description:
      "This exhibition features works by 15 contemporary artists who are redefining the boundaries of modern art. From digital installations to traditional paintings with a contemporary twist, visitors will experience a diverse range of artistic expressions. The exhibition includes interactive pieces, multimedia installations, and thought-provoking sculptures that challenge conventional perspectives on art and society.",
  },
  {
    id: "4",
    title: "Startup Pitch Competition",
    summary:
      "Watch innovative startups compete for funding and mentorship opportunities. See the next generation of entrepreneurs present their game-changing ideas to a panel of experienced investors.",
    date: "Sep 28",
    time: "2:00 PM",
    location: "Innovation Hub, Austin",
    category: "Business",
    description:
      "The annual Startup Pitch Competition brings together the most promising early-stage companies in the region. Ten selected startups will present their business models, market strategies, and growth plans to a distinguished panel of venture capitalists and successful entrepreneurs. The winner receives $50,000 in seed funding plus six months of mentorship from industry veterans.",
  },
  {
    id: "5",
    title: "Sustainable Living Workshop",
    summary:
      "Learn practical strategies for reducing your environmental impact through sustainable living practices. Expert speakers will share actionable tips for eco-friendly lifestyle changes.",
    date: "Oct 12",
    time: "10:00 AM",
    location: "Community Center, Portland",
    category: "Sustainability",
    description:
      "This hands-on workshop covers everything from zero-waste living and renewable energy solutions to sustainable fashion and ethical consumption. Participants will learn practical skills like composting, DIY cleaning products, and energy-efficient home improvements. The event includes a sustainable marketplace featuring local eco-friendly vendors and a plant-based lunch prepared by local sustainable restaurants.",
  },
  {
    id: "6",
    title: "Digital Marketing Masterclass",
    summary:
      "Master the latest digital marketing strategies and tools. Industry experts share insights on social media marketing, content creation, and data analytics for business growth.",
    date: "Oct 25",
    time: "1:00 PM",
    location: "Business District, Chicago",
    category: "Marketing",
    description:
      "A comprehensive masterclass covering the complete digital marketing ecosystem. Topics include advanced social media strategies, content marketing that converts, email automation, SEO optimization, and data-driven decision making. Attendees will receive practical templates, checklists, and tools to implement immediately in their businesses or careers.",
  },
];

const EventArchetype = () => {
  return (
    <main className="flex flex-col p-20">
      <div className="flex flex-col gap-4">
        {mockEvents.map((event) => {
          return <EventCard key={event.id} event={event} variant="compact" />;
        })}
      </div>
    </main>
  );
};

export default EventArchetype;
