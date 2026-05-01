import { Navbar } from "../components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const user = {
    name: "Felipe",
    avatar: "https://i.pravatar.cc/40",
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Navbar />

      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm">
          {/* Greeting */}
          <div>
            <h1 className="text-lg font-semibold">
              {getGreeting()}, {user.name}
            </h1>
            <p className="text-sm text-gray-500">Activity today</p>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-6">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{user.name}</span>
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>FE</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="p-6">{/* content */}</main>
      </div>
    </div>
  );
};

export default Dashboard;
