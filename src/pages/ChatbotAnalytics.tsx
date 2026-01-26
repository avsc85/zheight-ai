import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Search, MessageSquare, AlertTriangle, TrendingUp, Calendar, Filter, RefreshCw, Eye } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  session_id: string;
  created_at: string;
}

interface SessionWithMessages {
  session_id: string;
  messages: ChatMessage[];
  created_at: string;
  hasUnanswered: boolean;
  messageCount: number;
}

// Low-confidence indicators in AI responses
const LOW_CONFIDENCE_PHRASES = [
  "i'm not sure",
  "i don't have",
  "i cannot find",
  "no information",
  "unable to",
  "i apologize",
  "sorry",
  "don't know",
  "cannot help",
  "outside my knowledge",
  "not in my knowledge",
];

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const ChatbotAnalytics = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('7d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unanswered' | 'low-confidence'>('all');
  const [selectedSession, setSelectedSession] = useState<SessionWithMessages | null>(null);

  // Fetch all chat messages
  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['chatbot-messages', dateFilter],
    queryFn: async () => {
      const daysAgo = dateFilter === '24h' ? 1 : dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      const fromDate = subDays(new Date(), daysAgo).toISOString();

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ChatMessage[];
    },
  });

  // Process messages into sessions
  const sessions: SessionWithMessages[] = messages ? 
    Object.values(
      messages.reduce((acc, msg) => {
        if (!acc[msg.session_id]) {
          acc[msg.session_id] = {
            session_id: msg.session_id,
            messages: [],
            created_at: msg.created_at,
            hasUnanswered: false,
            messageCount: 0,
          };
        }
        acc[msg.session_id].messages.push(msg);
        acc[msg.session_id].messageCount++;
        
        // Check for unanswered (user message without AI response)
        const userMessages = acc[msg.session_id].messages.filter(m => m.role === 'user');
        const assistantMessages = acc[msg.session_id].messages.filter(m => m.role === 'assistant');
        acc[msg.session_id].hasUnanswered = userMessages.length > assistantMessages.length;
        
        return acc;
      }, {} as Record<string, SessionWithMessages>)
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  : [];

  // Check if message has low confidence
  const hasLowConfidence = (content: string) => {
    const lowerContent = content.toLowerCase();
    return LOW_CONFIDENCE_PHRASES.some(phrase => lowerContent.includes(phrase));
  };

  // Get low confidence sessions
  const getLowConfidenceSessions = () => {
    return sessions.filter(session => 
      session.messages.some(msg => msg.role === 'assistant' && hasLowConfidence(msg.content))
    );
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    // Search filter
    if (searchQuery) {
      const hasMatch = session.messages.some(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!hasMatch) return false;
    }

    // Status filter
    if (statusFilter === 'unanswered' && !session.hasUnanswered) return false;
    if (statusFilter === 'low-confidence') {
      const isLowConfidence = session.messages.some(msg => 
        msg.role === 'assistant' && hasLowConfidence(msg.content)
      );
      if (!isLowConfidence) return false;
    }

    return true;
  });

  // Analytics data
  const totalMessages = messages?.length || 0;
  const totalSessions = sessions.length;
  const unansweredCount = sessions.filter(s => s.hasUnanswered).length;
  const lowConfidenceCount = getLowConfidenceSessions().length;

  // Messages by day for chart
  const messagesByDay = messages ? 
    Object.entries(
      messages.reduce((acc, msg) => {
        const day = format(parseISO(msg.created_at), 'MMM dd');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([date, count]) => ({ date, count })).reverse().slice(-14)
  : [];

  // Role distribution for pie chart
  const roleDistribution = messages ?
    [
      { name: 'User Messages', value: messages.filter(m => m.role === 'user').length },
      { name: 'AI Responses', value: messages.filter(m => m.role === 'assistant').length },
    ]
  : [];

  // Quality metrics
  const qualityData = [
    { name: 'Answered', value: totalSessions - unansweredCount, color: 'hsl(var(--chart-2))' },
    { name: 'Unanswered', value: unansweredCount, color: 'hsl(var(--destructive))' },
    { name: 'Low Confidence', value: lowConfidenceCount, color: 'hsl(var(--chart-4))' },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chatbot Analytics</h1>
            <p className="text-muted-foreground mt-1">Monitor and improve AI assistant performance</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Messages</p>
                  <p className="text-2xl font-bold">{totalMessages}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-chart-2/10">
                  <TrendingUp className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chat Sessions</p>
                  <p className="text-2xl font-bold">{totalSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={unansweredCount > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unanswered</p>
                  <p className="text-2xl font-bold">{unansweredCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={lowConfidenceCount > 0 ? 'border-chart-4/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-chart-4/10">
                  <AlertTriangle className="h-6 w-6 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Low Confidence</p>
                  <p className="text-2xl font-bold">{lowConfidenceCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="messages" className="space-y-6">
          <TabsList>
            <TabsTrigger value="messages">Message Logs</TabsTrigger>
            <TabsTrigger value="analytics">Visual Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[150px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      <SelectItem value="unanswered">Unanswered Only</SelectItem>
                      <SelectItem value="low-confidence">Low Confidence Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Sessions Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Chat Sessions ({filteredSessions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
                ) : filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No chat sessions found</div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>First Message</TableHead>
                          <TableHead>Messages</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSessions.map((session) => {
                          const firstUserMessage = session.messages.find(m => m.role === 'user');
                          const isLowConfidence = session.messages.some(
                            m => m.role === 'assistant' && hasLowConfidence(m.content)
                          );

                          return (
                            <TableRow key={session.session_id} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-mono text-xs">
                                {session.session_id.slice(0, 8)}...
                              </TableCell>
                              <TableCell className="max-w-[300px] truncate">
                                {firstUserMessage?.content || 'No user message'}
                              </TableCell>
                              <TableCell>{session.messageCount}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {session.hasUnanswered && (
                                    <Badge variant="destructive" className="text-xs">Unanswered</Badge>
                                  )}
                                  {isLowConfidence && (
                                    <Badge variant="outline" className="text-xs border-chart-4 text-chart-4">
                                      Low Confidence
                                    </Badge>
                                  )}
                                  {!session.hasUnanswered && !isLowConfidence && (
                                    <Badge variant="secondary" className="text-xs">Resolved</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(parseISO(session.created_at), 'MMM dd, yyyy HH:mm')}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setSelectedSession(session)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Messages Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Messages Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={messagesByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Message Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Message Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={roleDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {roleDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quality Metrics */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Session Quality Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={qualityData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {qualityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Session Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Session: {selectedSession?.session_id.slice(0, 16)}...</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {selectedSession?.messages
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((msg) => (
                  <div 
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-primary/10 ml-8' 
                        : 'bg-muted mr-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                        {msg.role === 'user' ? 'User' : 'AI'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(msg.created_at), 'HH:mm:ss')}
                      </span>
                      {msg.role === 'assistant' && hasLowConfidence(msg.content) && (
                        <Badge variant="outline" className="text-xs border-chart-4 text-chart-4">
                          Low Confidence
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotAnalytics;
