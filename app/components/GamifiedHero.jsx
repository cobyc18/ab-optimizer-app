import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { 
  StarIcon, 
  BoltIcon, 
  BeakerIcon, 
  SparklesIcon 
} from "@heroicons/react/24/outline";

export default function GamifiedHero({ user, experiments = [] }) {
  const testsThisWeek = experiments.filter(exp => {
    if (!exp.createdAt) return false;
    const created = new Date(exp.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created >= weekAgo;
  }).length;

  const variantsCreated = user?.variantsCreated || 0;
  const pointsEarned = user?.pointsEarned || 0;

  const getBadgeContent = () => {
    const level = user?.currentLevel || "Rookie Scientist";
    const streak = user?.streak || 0;
    
    return {
      title: `🏅 ${level}`,
      subtitle: streak > 0 
        ? `You've run a test for ${streak} days straight!`
        : "Ready to start your testing journey!"
    };
  };

  const badge = getBadgeContent();

  return (
    <Card className="bg-gradient-to-br from-blue-600 to-purple-600 text-white overflow-hidden relative">
      <CardContent className="p-8">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center badge-glow animate-pulse">
                <StarIcon className="w-8 h-8 text-white" />
              </div>
              {user?.currentLevel && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {Math.min(Math.floor((user.xp || 0) / 500) + 1, 5)}
                  </span>
                </div>
              )}
            </div>
            <div className="ml-6">
              <h2 className="text-2xl font-semibold">{badge.title}</h2>
              <p className="text-white/90 mt-1">{badge.subtitle}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center justify-center mb-2">
                <BoltIcon className="w-4 h-4 mr-1" />
                <p className="text-2xl font-bold">{testsThisWeek}</p>
              </div>
              <p className="text-white/80 text-sm">Tests this week</p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center justify-center mb-2">
                <BeakerIcon className="w-4 h-4 mr-1" />
                <p className="text-2xl font-bold">{variantsCreated}</p>
              </div>
              <p className="text-white/80 text-sm">Variants created</p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center justify-center mb-2">
                <SparklesIcon className="w-4 h-4 mr-1" />
                <p className="text-2xl font-bold">{pointsEarned}</p>
              </div>
              <p className="text-white/80 text-sm">Points earned</p>
            </div>
          </div>
        </div>

        {/* Achievement Progress */}
        {user?.badges && user.badges.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <div className="flex items-center space-x-2">
              <span className="text-white/80 text-sm">Recent achievements:</span>
              <div className="flex space-x-2">
                {user.badges.slice(0, 3).map((badgeId, index) => (
                  <Badge key={index} variant="secondary" className="bg-white/20 text-white border-white/30">
                    🏆 Badge {badgeId}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 