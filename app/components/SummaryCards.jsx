import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { 
  BeakerIcon, 
  TrophyIcon, 
  CurrencyDollarIcon, 
  StarIcon, 
  ArrowTrendingUpIcon 
} from "@heroicons/react/24/outline";

export default function SummaryCards({ user, experiments = [] }) {
  const activeExperiments = experiments.filter(exp => exp.status === "running").length;
  const completedThisMonth = experiments.filter(exp => {
    if (!exp.createdAt) return false;
    const created = new Date(exp.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && 
           created.getFullYear() === now.getFullYear() &&
           exp.status === "completed";
  }).length;

  const totalRevenueLift = experiments
    .filter(exp => exp.revenueLift)
    .reduce((sum, exp) => sum + parseFloat(exp.revenueLift || "0"), 0);

  const avgLift = experiments
    .filter(exp => exp.lift && exp.status === "completed")
    .reduce((sum, exp, _, arr) => {
      const lift = parseFloat(exp.lift || "0");
      return arr.length > 0 ? sum + lift / arr.length : 0;
    }, 0);

  const getXPProgress = () => {
    if (!user) return { current: 0, total: 2500, percentage: 0 };
    
    const currentXP = user.xp || 0;
    const nextLevelXP = Math.ceil(currentXP / 500) * 500 + 500;
    const percentage = Math.min((currentXP / nextLevelXP) * 100, 100);
    
    return {
      current: currentXP,
      total: nextLevelXP,
      percentage
    };
  };

  const xpProgress = getXPProgress();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Active Experiments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 flex items-center">
            <BeakerIcon className="w-4 h-4 mr-2 text-blue-500" />
            Active Experiments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-neutral-800">{activeExperiments}</div>
          <div className="mt-4">
            {/* Sparkline placeholder */}
            <div className="sparkline bg-gradient-to-r from-blue-500/20 to-blue-500/40 rounded h-5"></div>
          </div>
          <p className="text-xs text-neutral-600 mt-2">Currently running</p>
        </CardContent>
      </Card>

      {/* Wins This Month */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 flex items-center">
            <TrophyIcon className="w-4 h-4 mr-2 text-orange-500" />
            Wins This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-neutral-800">{completedThisMonth}</div>
          <div className="flex items-center mt-2">
            <ArrowTrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />
            <p className="text-xs text-green-600">
              {completedThisMonth > 0 ? "+25% from last month" : "Start testing to see wins"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Lift */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 flex items-center">
            <CurrencyDollarIcon className="w-4 h-4 mr-2 text-green-500" />
            Revenue Lift
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-neutral-800">
            ${totalRevenueLift.toLocaleString()}
          </div>
          <p className="text-xs text-green-600 mt-2">
            {avgLift > 0 ? `+${avgLift.toFixed(1)}% total lift` : "No lift data yet"}
          </p>
        </CardContent>
      </Card>

      {/* Your Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 flex items-center">
            <StarIcon className="w-4 h-4 mr-2 text-blue-500" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-neutral-800">
            {user?.currentLevel || "Rookie Scientist"}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-neutral-600">
              <span>Level Progress</span>
              <span>{xpProgress.current} / {xpProgress.total} XP</span>
            </div>
            <Progress value={xpProgress.percentage} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 