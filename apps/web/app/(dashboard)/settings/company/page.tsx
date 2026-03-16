'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, MapPin, FileText, CreditCard, Loader2 } from 'lucide-react';
import { settingsApi } from '@/lib/api/settings';

// Australian states
const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Company information (persisted via API)
  const [companyName, setCompanyName] = useState('CCW Equipment Supplies');
  const [tradingName, setTradingName] = useState('');
  const [abn, setAbn] = useState('51 824 753 556');
  const [acn, setAcn] = useState('');

  // Address (UI state — not persisted in current schema)
  const [address, setAddress] = useState('123 Industrial Drive');
  const [city, setCity] = useState('Brisbane');
  const [state, setState] = useState('QLD');
  const [postcode, setPostcode] = useState('4000');

  // Contact (UI state — not persisted in current schema)
  const [phone, setPhone] = useState('+61 7 3000 0000');
  const [email, setEmail] = useState('contact@ccw.com.au');
  const [website, setWebsite] = useState('https://ccw.com.au');

  // Financial (UI state — not persisted in current schema)
  const [bankName, setBankName] = useState('');
  const [bsb, setBsb] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Load current company settings on mount
  useEffect(() => {
    async function loadCompany() {
      try {
        const company = await settingsApi.getCompany();
        setCompanyName(company.name);
      } catch {
        // Use defaults if not available
      } finally {
        setIsFetching(false);
      }
    }
    loadCompany();
  }, []);

  async function handleUpdateCompany(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updated = await settingsApi.updateCompany({ name: companyName });
      setCompanyName(updated.name);

      toast({
        title: 'Company Updated',
        description: 'Company information has been updated successfully',
      });
    } catch (error: unknown) {
      toast({
        title: 'Update Failed',
        description:
          error instanceof Error ? error.message : 'Failed to update company information',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Building2 className="h-8 w-8" />
          Company Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your organization&apos;s information and settings
        </p>
      </div>

      <form onSubmit={handleUpdateCompany} className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Legal Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="CCW Equipment Supplies Pty Ltd"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradingName">Trading Name</Label>
                <Input
                  id="tradingName"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  placeholder="CCW Equipment"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="51 824 753 556"
                  disabled={isLoading}
                />
                <p className="text-muted-foreground text-xs">Australian Business Number</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="acn">ACN</Label>
                <Input
                  id="acn"
                  value={acn}
                  onChange={(e) => setAcn(e.target.value)}
                  placeholder="123 456 789"
                  disabled={isLoading}
                />
                <p className="text-muted-foreground text-xs">Australian Company Number</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Business Address
            </CardTitle>
            <CardDescription>Primary business address for invoicing and shipping</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Industrial Drive"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Brisbane"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={state} onValueChange={setState} disabled={isLoading}>
                  <SelectTrigger id="state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUSTRALIAN_STATES.map((st) => (
                      <SelectItem key={st.value} value={st.value}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="4000"
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>Public contact details for customers and suppliers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+61 7 3000 0000"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email Address</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@ccw.com.au"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://ccw.com.au"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Financial Information
            </CardTitle>
            <CardDescription>Banking details for payments and invoicing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Commonwealth Bank"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bsb">BSB</Label>
                <Input
                  id="bsb"
                  value={bsb}
                  onChange={(e) => setBsb(e.target.value)}
                  placeholder="062-000"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="12345678"
                  type="password"
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Company Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
