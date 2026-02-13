import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConversations } from "@/hooks/useConversations";
import { useGroupChats } from "@/hooks/useGroupChats";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, MessageCircle, Users, Megaphone, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";
import { toast } from "sonner";
import { NotificationsTab } from "@/components/notifications/NotificationsTab";

// Group components
import { NewChatMenu } from "@/components/groups/NewChatMenu";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { AddMembersDialog } from "@/components/groups/AddMembersDialog";
import { ChannelVisibilityDialog } from "@/components/groups/ChannelVisibilityDialog";
import { GroupChatItem } from "@/components/groups/GroupChatItem";

interface FollowUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

type TabValue = "all" | "groups" | "channels" | "followers" | "following" | "notifications";

interface PendingGroupData {
  name: string;
  description: string;
  avatarUrl: string | null;
  memberIds?: string[];
}

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { conversations, isLoading: convLoading, totalUnread } = useConversations();
  const { groups, channels, isLoading: groupsLoading, createGroupChat, refetch: refetchGroups } = useGroupChats();
  const { unreadCount: notifUnreadCount } = useNotifications();

  // Check if tab param is set to notifications
  const initialTab = searchParams.get("tab") === "notifications" ? "notifications" : "all";
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Group/Channel creation flow
  const [createType, setCreateType] = useState<"group" | "channel" | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false);
  const [pendingGroupData, setPendingGroupData] = useState<PendingGroupData | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchFollowUsers = async () => {
      // Fetch followers
      const { data: followersData } = await supabase.from("follows").select("follower_id").eq("following_id", user.id);

      if (followersData) {
        const followerIds = followersData.map((f) => f.follower_id);
        if (followerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .in("id", followerIds);
          setFollowers(profiles || []);
        }
      }

      // Fetch following
      const { data: followingData } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);

      if (followingData) {
        const followingIds = followingData.map((f) => f.following_id);
        if (followingIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .in("id", followingIds);
          setFollowing(profiles || []);
        }
      }
    };

    fetchFollowUsers();
  }, [user?.id]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const handleUserClick = (userId: string) => {
    navigate(`/chat/${userId}`);
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/group-chat/${groupId}`);
  };

  // Filter functions
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const name = conv.otherUser.name?.toLowerCase() || "";
    const username = conv.otherUser.username?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const filteredGroups = groups.filter((g) => {
    if (!searchQuery) return true;
    return g.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredChannels = channels.filter((c) => {
    if (!searchQuery) return true;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredFollowers = followers.filter((f) => {
    if (!searchQuery) return true;
    const name = f.name?.toLowerCase() || "";
    const username = f.username?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const filteredFollowing = following.filter((f) => {
    if (!searchQuery) return true;
    const name = f.name?.toLowerCase() || "";
    const username = f.username?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  // Create group/channel handlers
  const handleNewGroup = () => {
    setCreateType("group");
    setShowCreateDialog(true);
  };

  const handleNewChannel = () => {
    setCreateType("channel");
    setShowCreateDialog(true);
  };

  const handleCreateNext = (name: string, description: string, avatarUrl: string | null) => {
    setPendingGroupData({ name, description, avatarUrl });
    setShowCreateDialog(false);
    setShowMembersDialog(true);
  };

  const handleMembersComplete = async (memberIds: string[]) => {
    if (!pendingGroupData || !createType) return;

    if (createType === "channel") {
      setShowMembersDialog(false);
      setShowVisibilityDialog(true);
      // Store memberIds temporarily
      setPendingGroupData({
        ...pendingGroupData,
        memberIds: memberIds as any,
      });
    } else {
      // Create group immediately
      const groupId = await createGroupChat(
        pendingGroupData.name,
        "group",
        memberIds,
        pendingGroupData.description,
        pendingGroupData.avatarUrl || undefined,
        "private",
      );

      if (groupId) {
        toast.success("Guruh yaratildi!");
        setShowMembersDialog(false);
        resetCreateFlow();
        navigate(`/group-chat/${groupId}`);
      } else {
        toast.error("Xatolik yuz berdi");
      }
    }
  };

  const handleVisibilityComplete = async (visibility: "public" | "private", inviteLink: string) => {
    if (!pendingGroupData || !createType) return;

    const memberIds = (pendingGroupData as any).memberIds || [];

    const channelId = await createGroupChat(
      pendingGroupData.name,
      "channel",
      memberIds,
      pendingGroupData.description,
      pendingGroupData.avatarUrl || undefined,
      visibility,
    );

    if (channelId) {
      toast.success("Kanal yaratildi!");
      setShowVisibilityDialog(false);
      resetCreateFlow();
      navigate(`/group-chat/${channelId}`);
    } else {
      toast.error("Xatolik yuz berdi");
    }
  };

  const resetCreateFlow = () => {
    setCreateType(null);
    setPendingGroupData(null);
    setShowCreateDialog(false);
    setShowMembersDialog(false);
    setShowVisibilityDialog(false);
  };

  const isLoading = convLoading || groupsLoading;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold flex-1">Xabarlar</h1>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {totalUnread}
              </Badge>
            )}
            <NewChatMenu onNewGroup={handleNewGroup} onNewChannel={handleNewChannel} />
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs - 2 rows */}
          <div className="px-4 pb-2 space-y-2">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("all")}
                className="flex-1"
              >
                Barcha
              </Button>
              <Button
                variant={activeTab === "groups" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("groups")}
                className="flex-1"
              >
                <Users className="h-4 w-4 mr-1" />
                Guruhlar
              </Button>
              <Button
                variant={activeTab === "channels" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("channels")}
                className="flex-1"
              >
                <Megaphone className="h-4 w-4 mr-1" />
                Kanallar
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === "followers" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("followers")}
                className="flex-1"
              >
                Kuzatuvchilar
              </Button>
              <Button
                variant={activeTab === "following" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("following")}
                className="flex-1"
              >
                Kuzatilmoqda
              </Button>
              <Button
                variant={activeTab === "notifications" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("notifications")}
                className="flex-1 relative"
              >
                <Bell className="h-4 w-4 mr-1" />

                {notifUnreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] min-w-4"
                  >
                    {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="divide-y divide-border">
          {/* All chats */}
          {activeTab === "all" && (
            <>
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Yuklanmoqda...</p>
                </div>
              ) : (
                <>
                  {/* Groups */}
                  {filteredGroups.map((group) => (
                    <GroupChatItem key={group.id} chat={group} onClick={() => handleGroupClick(group.id)} />
                  ))}

                  {/* Channels */}
                  {filteredChannels.map((channel) => (
                    <GroupChatItem key={channel.id} chat={channel} onClick={() => handleGroupClick(channel.id)} />
                  ))}

                  {/* Conversations */}
                  {filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleUserClick(conv.otherUser.id)}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors"
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.otherUser.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(conv.otherUser.name)}</AvatarFallback>
                        </Avatar>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold truncate">
                            {conv.otherUser.name || conv.otherUser.username || "Foydalanuvchi"}
                          </h3>
                          {conv.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conv.lastMessage.created_at)}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p
                            className={`text-sm truncate ${conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                          >
                            {conv.lastMessage.sender_id === user?.id ? "Siz: " : ""}
                            {conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredConversations.length === 0 &&
                    filteredGroups.length === 0 &&
                    filteredChannels.length === 0 && (
                      <div className="text-center py-12 px-4">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Hozircha chatlar yo'q</p>
                        <p className="text-sm text-muted-foreground mt-1">Guruh yoki kanal yarating</p>
                      </div>
                    )}
                </>
              )}
            </>
          )}

          {/* Groups */}
          {activeTab === "groups" && (
            <>
              {groupsLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Yuklanmoqda...</p>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Guruhlar yo'q</p>
                  <Button variant="link" onClick={handleNewGroup}>
                    Yangi guruh yaratish
                  </Button>
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <GroupChatItem key={group.id} chat={group} onClick={() => handleGroupClick(group.id)} />
                ))
              )}
            </>
          )}

          {/* Channels */}
          {activeTab === "channels" && (
            <>
              {groupsLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Yuklanmoqda...</p>
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Kanallar yo'q</p>
                  <Button variant="link" onClick={handleNewChannel}>
                    Yangi kanal yaratish
                  </Button>
                </div>
              ) : (
                filteredChannels.map((channel) => (
                  <GroupChatItem key={channel.id} chat={channel} onClick={() => handleGroupClick(channel.id)} />
                ))
              )}
            </>
          )}

          {/* Followers */}
          {activeTab === "followers" && (
            <>
              {filteredFollowers.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-muted-foreground">Kuzatuvchilar yo'q</p>
                </div>
              ) : (
                filteredFollowers.map((follower) => (
                  <div
                    key={follower.id}
                    onClick={() => handleUserClick(follower.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={follower.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(follower.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{follower.name || "Foydalanuvchi"}</h3>
                      <p className="text-sm text-muted-foreground truncate">@{follower.username || "username"}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Xabar
                    </Button>
                  </div>
                ))
              )}
            </>
          )}

          {/* Following */}
          {activeTab === "following" && (
            <>
              {filteredFollowing.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-muted-foreground">Hech kimni kuzatmayapsiz</p>
                </div>
              ) : (
                filteredFollowing.map((followingUser) => (
                  <div
                    key={followingUser.id}
                    onClick={() => handleUserClick(followingUser.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={followingUser.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(followingUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{followingUser.name || "Foydalanuvchi"}</h3>
                      <p className="text-sm text-muted-foreground truncate">@{followingUser.username || "username"}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Xabar
                    </Button>
                  </div>
                ))
              )}
            </>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && <NotificationsTab />}
        </div>
      </div>

      {/* Dialogs */}
      {createType && (
        <>
          <CreateGroupDialog
            open={showCreateDialog}
            onOpenChange={(open) => {
              if (!open) resetCreateFlow();
              setShowCreateDialog(open);
            }}
            type={createType}
            onNext={handleCreateNext}
          />
          <AddMembersDialog
            open={showMembersDialog}
            onOpenChange={(open) => {
              if (!open) resetCreateFlow();
              setShowMembersDialog(open);
            }}
            type={createType}
            onComplete={handleMembersComplete}
            onBack={() => {
              setShowMembersDialog(false);
              setShowCreateDialog(true);
            }}
          />
          {createType === "channel" && (
            <ChannelVisibilityDialog
              open={showVisibilityDialog}
              onOpenChange={(open) => {
                if (!open) resetCreateFlow();
                setShowVisibilityDialog(open);
              }}
              onComplete={handleVisibilityComplete}
              onBack={() => {
                setShowVisibilityDialog(false);
                setShowMembersDialog(true);
              }}
            />
          )}
        </>
      )}
    </AppLayout>
  );
};

export default Messages;
